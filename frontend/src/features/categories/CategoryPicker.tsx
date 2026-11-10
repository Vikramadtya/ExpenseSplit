import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Search, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createCategoryMutation } from '../../api/@tanstack/react-query.gen';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useCategories } from './useCategories';

interface Props {
  workspaceId: string;
  value: string;
  onChange: (name: string) => void;
  /** Adds an "All categories" row whose value is `allValue`; used by filters. */
  allLabel?: string;
  allValue?: string;
  /** Opens the category manager from the footer. */
  onManage?: () => void;
  /** Pill look for forms; plain for toolbars. */
  variant?: 'pill' | 'bar';
}

interface Row {
  key: string;
  name: string;
  icon: string;
  depth: 0 | 1;
}

/** A searchable category picker: type to filter, arrows + Enter to choose, or create on the spot. */
export function CategoryPicker({
  workspaceId,
  value,
  onChange,
  allLabel,
  allValue = 'ALL',
  onManage,
  variant = 'pill',
}: Props) {
  const { roots, childrenOf, iconOf, pathOf } = useCategories(workspaceId);
  const queryClient = useQueryClient();
  const create = useMutation(createCategoryMutation());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useClickOutside(box, open, closeMenu);

  const needle = query.trim().toLowerCase();
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (allLabel && !needle) out.push({ key: 'all', name: allValue, icon: '🗂️', depth: 0 });
    for (const root of roots) {
      const kids = childrenOf(root.id);
      const rootMatches = root.name.toLowerCase().includes(needle);
      const matchingKids = kids.filter((k) => k.name.toLowerCase().includes(needle));
      if (!rootMatches && matchingKids.length === 0) continue;
      out.push({ key: root.id, name: root.name, icon: root.icon, depth: 0 });
      for (const kid of rootMatches ? kids : matchingKids) {
        out.push({ key: kid.id, name: kid.name, icon: kid.icon, depth: 1 });
      }
    }
    return out;
  }, [roots, childrenOf, needle, allLabel, allValue]);

  const exact = rows.some((r) => r.name.toLowerCase() === needle);
  const canCreate = needle.length > 0 && !exact && query.trim().length <= 40;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const createAndPick = async () => {
    try {
      const created = await create.mutateAsync({
        path: { workspaceId },
        body: { name: query.trim() },
      });
      await queryClient.invalidateQueries();
      pick(created.name);
    } catch {
      toast.error('Could not create the category');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const total = rows.length + (canCreate ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(total, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + total) % Math.max(total, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < rows.length) pick(rows[active].name);
      else if (canCreate) void createAndPick();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const isAll = value === allValue && allLabel;
  const label = isAll ? allLabel : pathOf(value);
  const icon = isAll ? '🗂️' : iconOf(value);

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          variant === 'pill'
            ? 'pill'
            : 'press flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text-main'
        }
      >
        <span aria-hidden>{icon}</span>
        <span className="max-w-[15rem] truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
      </button>

      {open && (
        <div className="anim-pop absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search or create…"
              className="w-full bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {rows.map((r, i) => (
              <li key={r.key} role="option" aria-selected={r.name === value}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r.name)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm ${r.depth ? 'pl-9' : ''} ${i === active ? 'bg-primary/10' : ''} ${r.name === value ? 'font-semibold text-primary' : 'text-text-main'}`}
                >
                  <span aria-hidden>{r.icon}</span>
                  <span className="truncate">{r.key === 'all' ? allLabel : r.name}</span>
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  onMouseEnter={() => setActive(rows.length)}
                  onClick={() => void createAndPick()}
                  disabled={create.isPending}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-primary ${active === rows.length ? 'bg-primary/10' : ''}`}
                >
                  <Plus className="h-4 w-4" />
                  <span className="truncate">Create “{query.trim()}”</span>
                </button>
              </li>
            )}
            {rows.length === 0 && !canCreate && (
              <li className="px-3 py-6 text-center text-sm text-text-muted">No categories</li>
            )}
          </ul>
          {onManage && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-text-muted hover:bg-surface hover:text-text-main"
            >
              <Settings2 className="h-4 w-4" /> Manage categories
            </button>
          )}
        </div>
      )}
    </div>
  );
}
