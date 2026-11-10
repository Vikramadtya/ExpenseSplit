import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listCategoriesOptions } from '../../api/@tanstack/react-query.gen';
import type { Category } from '../../api/types.gen';

const FALLBACK_ICON = '📦';

/** A stable hue per top-level category, so a child shares its parent's colour. */
const hueOf = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};

/** Soft tinted background and readable foreground for a category badge, in light and dark. */
export const categoryStyle = (rootName: string) => {
  const h = hueOf(rootName);
  return {
    backgroundColor: `hsl(${h} 85% 55% / 0.14)`,
    color: `hsl(${h} 65% 45%)`,
  };
};

/** The workspace's category tree with the lookups every screen needs. */
export function useCategories(workspaceId: string) {
  const { data = [], isLoading } = useQuery({
    ...listCategoriesOptions({ path: { workspaceId } }),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const byName = new Map(data.map((c) => [c.name.toLowerCase(), c]));
    const byId = new Map(data.map((c) => [c.id, c]));
    const roots = data.filter((c) => !c.parentId);
    const childrenOf = (id: string) => data.filter((c) => c.parentId === id);
    const find = (name: string) => byName.get(name.toLowerCase());
    const rootOf = (name: string): Category | undefined => {
      const c = find(name);
      return c?.parentId ? byId.get(c.parentId) : c;
    };
    return {
      categories: data,
      roots,
      childrenOf,
      isLoading,
      iconOf: (name: string) => find(name)?.icon ?? FALLBACK_ICON,
      /** "Food & Drink › Coffee" for a child, the plain name otherwise. */
      pathOf: (name: string) => {
        const c = find(name);
        const parent = c?.parentId ? byId.get(c.parentId) : undefined;
        return parent ? `${parent.name} › ${c?.name}` : name;
      },
      styleOf: (name: string) => categoryStyle(rootOf(name)?.name ?? name),
    };
  }, [data, isLoading]);
}
