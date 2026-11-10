import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CornerDownRight, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createCategoryMutation,
  deleteCategoryMutation,
  listCategoriesQueryKey,
  updateCategoryMutation,
} from '../../api/@tanstack/react-query.gen';
import type { Category } from '../../api/types.gen';
import { Sheet } from '../../components/ui/Sheet';
import { categoryStyle, useCategories } from './useCategories';

const EMOJIS = [
  '🍽️',
  '☕',
  '🍺',
  '🛒',
  '🚗',
  '🚆',
  '✈️',
  '⛽',
  '🏠',
  '🛏️',
  '💡',
  '📶',
  '🎬',
  '🎮',
  '🎁',
  '🛍️',
  '👕',
  '❤️',
  '💊',
  '🏋️',
  '📚',
  '🎓',
  '🐶',
  '👶',
  '🧾',
  '🔧',
  '🎉',
  '🌴',
  '💼',
  '📦',
  '📁',
  '⭐',
];

const message = (err: unknown) =>
  (err as { message?: string })?.message ?? 'Something went wrong. Please try again.';

interface Props {
  workspaceId: string;
  onClose: () => void;
}

/** Create, rename, re-icon, nest and delete the workspace's categories. */
export function CategoryManager({ workspaceId, onClose }: Props) {
  const { roots, childrenOf, categories } = useCategories(workspaceId);
  const queryClient = useQueryClient();
  const create = useMutation(createCategoryMutation());
  const update = useMutation(updateCategoryMutation());
  const remove = useMutation(deleteCategoryMutation());

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', icon: '', parentId: '' });
  const [addingUnder, setAddingUnder] = useState<string | 'root' | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // The category list refreshes first (the sheet needs it); everything else catches up behind it.
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: listCategoriesQueryKey({ path: { workspaceId } }),
    });
    void queryClient.invalidateQueries();
  };

  const startEdit = (c: Category) => {
    setEditing(c.id);
    setConfirmDelete(null);
    setDraft({ name: c.name, icon: c.icon, parentId: c.parentId ?? '' });
  };

  const save = async (c: Category) => {
    try {
      await update.mutateAsync({
        path: { workspaceId, categoryId: c.id },
        body: {
          ...(draft.name.trim() !== c.name ? { name: draft.name.trim() } : {}),
          ...(draft.icon !== c.icon ? { icon: draft.icon } : {}),
          ...(c.locked || draft.parentId === (c.parentId ?? '')
            ? {}
            : { parentId: draft.parentId || null }),
        },
      });
      await refresh();
      setEditing(null);
    } catch (err) {
      toast.error(message(err));
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({
        path: { workspaceId },
        body: { name, parentId: addingUnder && addingUnder !== 'root' ? addingUnder : null },
      });
      await refresh();
      setNewName('');
      setAddingUnder(null);
    } catch (err) {
      toast.error(message(err));
    }
  };

  const destroy = async (c: Category) => {
    try {
      await remove.mutateAsync({ path: { workspaceId, categoryId: c.id } });
      await refresh();
      setConfirmDelete(null);
    } catch (err) {
      toast.error(message(err));
    }
  };

  const row = (c: Category, depth: 0 | 1) => {
    const parent = categories.find((p) => p.id === c.parentId);
    const isEditing = editing === c.id;
    return (
      <li key={c.id} className={depth ? 'ml-8' : ''}>
        <div className="group flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface">
          {depth === 1 && <CornerDownRight className="-ml-6 h-4 w-4 text-text-muted" aria-hidden />}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
            style={categoryStyle(parent?.name ?? c.name)}
          >
            {c.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-main">{c.name}</p>
            <p className="text-xs text-text-muted">
              {c.expenseCount} expense{c.expenseCount === 1 ? '' : 's'}
            </p>
          </div>
          {c.locked ? (
            <span title="Always available as the fallback" className="p-2 text-text-muted">
              <Lock className="h-4 w-4" />
            </span>
          ) : (
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {depth === 0 && (
                <button
                  type="button"
                  aria-label={`Add a sub-category to ${c.name}`}
                  onClick={() => {
                    setAddingUnder(c.id);
                    setNewName('');
                  }}
                  className="press rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Edit ${c.name}`}
                onClick={() => (isEditing ? setEditing(null) : startEdit(c))}
                className="press rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => setConfirmDelete(confirmDelete === c.id ? null : c.id)}
                className="press rounded-lg p-2 text-text-muted hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {confirmDelete === c.id && (
          <div className="anim-pop mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
            <span className="text-text-main">
              {c.expenseCount > 0
                ? `${c.expenseCount} expense${c.expenseCount === 1 ? '' : 's'} will move to ${parent?.name ?? 'Other'}.`
                : 'Delete this category?'}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-3 py-1 text-text-muted hover:bg-surface"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => void destroy(c)}
                className="rounded-lg bg-red-500 px-3 py-1 font-medium text-white"
              >
                Delete
              </button>
            </span>
          </div>
        )}

        {isEditing && (
          <div className="anim-pop mx-3 mb-2 space-y-3 rounded-2xl border border-border bg-surface p-3">
            <input
              autoFocus
              value={draft.name}
              maxLength={40}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && void save(c)}
              aria-label="Category name"
              className="field w-full"
            />
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraft({ ...draft, icon: emoji })}
                  className={`press h-8 w-8 rounded-lg text-lg hover:bg-primary/10 ${draft.icon === emoji ? 'bg-primary/15 ring-2 ring-primary/50' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {!c.locked && (
              <label className="flex items-center gap-2 text-sm text-text-muted">
                Inside
                <select
                  value={draft.parentId}
                  disabled={childrenOf(c.id).length > 0}
                  onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}
                  className="field"
                >
                  <option value="">Nothing (top level)</option>
                  {roots
                    .filter((r) => r.id !== c.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-background"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft.name.trim() || update.isPending}
                onClick={() => void save(c)}
                className="btn-primary"
              >
                <Check className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        )}

        {addingUnder === c.id && addRow()}
      </li>
    );
  };

  function addRow() {
    return (
      <div className="anim-pop mx-3 mb-2 ml-11 flex gap-2">
        <input
          autoFocus
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setAddingUnder(null);
            }
          }}
          placeholder="New category name"
          aria-label="New category name"
          className="field min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!newName.trim() || create.isPending}
          className="btn-primary"
        >
          Add
        </button>
      </div>
    );
  }

  return (
    <Sheet
      title="Categories"
      subtitle="Group spending your way. Sub-categories roll up into their parent."
      onClose={onClose}
      width="sm:max-w-lg"
      footer={
        addingUnder === 'root' ? (
          addRow()
        ) : (
          <button
            type="button"
            onClick={() => {
              setAddingUnder('root');
              setNewName('');
            }}
            className="btn-primary w-full py-3"
          >
            <Plus className="h-4 w-4" /> New category
          </button>
        )
      }
    >
      <div className="space-y-1">
        {roots.map((root) => (
          <ul key={root.id}>
            {row(root, 0)}
            {childrenOf(root.id).map((kid) => row(kid, 1))}
          </ul>
        ))}
      </div>
    </Sheet>
  );
}
