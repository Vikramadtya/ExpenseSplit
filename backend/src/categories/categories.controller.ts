import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CategoriesService } from './categories.service';

const name = z.string().trim().min(1).max(40);
const icon = z.string().trim().min(1).max(16);

export class CreateCategoryDto extends createZodDto(
  z.object({ name, icon: icon.optional(), parentId: z.string().uuid().nullish() }),
) {}

export class UpdateCategoryDto extends createZodDto(
  z.object({ name: name.optional(), icon: icon.optional(), parentId: z.string().uuid().nullish() }),
) {}

@Controller('api/v1/workspaces/:workspaceId/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.categories.list(workspaceId);
  }

  @Post()
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(workspaceId, dto);
  }

  @Patch(':categoryId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('categoryId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(workspaceId, id, dto);
  }

  @Delete(':categoryId')
  @HttpCode(204)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('categoryId', ParseUUIDPipe) id: string,
  ) {
    return this.categories.remove(workspaceId, id);
  }
}
