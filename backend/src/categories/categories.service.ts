import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_CATEGORY_ICONS, FALLBACK_CATEGORY } from '../common/categories';
import { Category, CategoriesRepository } from './categories.repository';

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  /** Every category of the workspace, seeding the defaults the first time it is asked. */
  private async all(workspaceId: string): Promise<Category[]> {
    const rows = await this.repository.list(workspaceId);
    if (rows.length > 0) return rows;
    await this.repository.seed(
      workspaceId,
      Object.entries(DEFAULT_CATEGORY_ICONS).map(([name, icon]) => ({ name, icon })),
    );
    return this.repository.list(workspaceId);
  }

  async list(workspaceId: string) {
    const [rows, usage] = await Promise.all([
      this.all(workspaceId),
      this.repository.usage(workspaceId),
    ]);
    return rows
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        parentId: c.parentId,
        expenseCount: usage.get(c.name) ?? 0,
        locked: c.name === FALLBACK_CATEGORY,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The workspace's spelling of a category name, or undefined when it does not exist. */
  async find(workspaceId: string, name: string): Promise<string | undefined> {
    const rows = await this.all(workspaceId);
    return rows.find((c) => sameName(c.name, name))?.name;
  }

  /** Like `find`, but unknown names land in the fallback category instead of failing. */
  async resolve(workspaceId: string, name: string): Promise<string> {
    return (await this.find(workspaceId, name)) ?? FALLBACK_CATEGORY;
  }

  /** The category and its children, so filters and budgets on a parent include the whole branch. */
  async branch(workspaceId: string, name: string): Promise<string[]> {
    const rows = await this.all(workspaceId);
    const root = rows.find((c) => sameName(c.name, name));
    if (!root) return [name];
    return [root.name, ...rows.filter((c) => c.parentId === root.id).map((c) => c.name)];
  }

  /** The names whose budgets also cover this category: itself and its parent. */
  async lineage(workspaceId: string, name: string): Promise<string[]> {
    const rows = await this.all(workspaceId);
    const self = rows.find((c) => sameName(c.name, name));
    const parent = self?.parentId ? rows.find((c) => c.id === self.parentId) : undefined;
    return [name, ...(parent ? [parent.name] : [])];
  }

  async create(
    workspaceId: string,
    data: { name: string; icon?: string; parentId?: string | null },
  ) {
    const rows = await this.all(workspaceId);
    this.assertNameFree(rows, data.name);
    if (data.parentId) this.assertCanBeParent(rows, data.parentId);
    return this.repository.insert({
      workspaceId,
      name: data.name,
      icon: data.icon ?? '📁',
      parentId: data.parentId ?? null,
    });
  }

  async update(
    workspaceId: string,
    id: string,
    data: { name?: string; icon?: string; parentId?: string | null },
  ) {
    const rows = await this.all(workspaceId);
    const existing = rows.find((c) => c.id === id);
    if (!existing) throw new NotFoundException('Category not found');
    const locked = existing.name === FALLBACK_CATEGORY;
    if (locked && (data.name !== undefined || data.parentId !== undefined)) {
      throw new BadRequestException(`"${FALLBACK_CATEGORY}" cannot be renamed or moved`);
    }
    if (data.name !== undefined && !sameName(data.name, existing.name)) {
      this.assertNameFree(rows, data.name);
    }
    if (data.parentId) {
      if (data.parentId === id)
        throw new BadRequestException('A category cannot be its own parent');
      if (rows.some((c) => c.parentId === id)) {
        throw new BadRequestException(
          'A category with sub-categories cannot become a sub-category',
        );
      }
      this.assertCanBeParent(rows, data.parentId);
    }
    return this.repository.update(workspaceId, existing, data);
  }

  async remove(workspaceId: string, id: string) {
    const rows = await this.all(workspaceId);
    const existing = rows.find((c) => c.id === id);
    if (!existing) throw new NotFoundException('Category not found');
    if (existing.name === FALLBACK_CATEGORY) {
      throw new BadRequestException(`"${FALLBACK_CATEGORY}" cannot be deleted`);
    }
    const parent = rows.find((c) => c.id === existing.parentId);
    await this.repository.remove(workspaceId, existing, parent?.name ?? FALLBACK_CATEGORY);
  }

  private assertNameFree(rows: Category[], name: string) {
    if (rows.some((c) => sameName(c.name, name))) {
      throw new ConflictException(`A category named "${name}" already exists`);
    }
  }

  /** Only one level of nesting: a parent must itself be a top-level category. */
  private assertCanBeParent(rows: Category[], parentId: string) {
    const parent = rows.find((c) => c.id === parentId);
    if (!parent) throw new BadRequestException('Parent category not found');
    if (parent.parentId)
      throw new BadRequestException('Categories can only be nested one level deep');
  }
}
