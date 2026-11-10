import { useCallback, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Hash, X } from 'lucide-react';
import { listTagsOptions } from '../../api/@tanstack/react-query.gen';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDebounced } from '../../hooks/useDebounced';

interface Props {
  workspaceId: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

/** "#Trip " and "trip" are the same tag; the server stores it this way too. */
export const normalizeTag = (raw: string) => raw.trim().replace(/^#+/, '').trim().toLowerCase();

/**
 * Chips plus a suggestion list: the workspace's most-used tags while the box is empty, matches as
 * you type, and "Create #new" for anything else. Enter, comma or Tab accept; Backspace removes.
 */
export function TagInput({ workspaceId, value, onChange, placeholder = 'Add tags' }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useClickOutside(box, open, closeMenu);

  const q = useDebounced(normalizeTag(text), 120);
  const { data = [] } = useQuery({
    ...listTagsOptions({ path: { workspaceId }, query: { q, limit: 10 } }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const typed = normalizeTag(text);
  const suggestions = data.filter((t) => !value.includes(t.tag)).slice(0, 6);
  const canCreate =
    typed.length > 0 && !value.includes(typed) && !data.some((t) => t.tag === typed);
  const total = suggestions.length + (canCreate ? 1 : 0);

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && tag.length <= 50 && !value.includes(tag) && value.length < 20)
      onChange([...value, tag]);
    setText('');
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + Math.max(total, 1)) % Math.max(total, 1));
    } else if (e.key === ',' && typed) {
      e.preventDefault();
      add(typed); // a comma always means "exactly what I typed"
    } else if (e.key === 'Enter' || (e.key === 'Tab' && typed)) {
      const highlighted = active < suggestions.length ? suggestions[active] : undefined;
      if (!typed && !(open && highlighted)) return; // let Enter submit the form
      e.preventDefault();
      if (highlighted) add(highlighted.tag);
      else add(typed);
    } else if (e.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={box} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2 transition-shadow focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30"
      >
        <Hash className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        {value.map((tag) => (
          <span
            key={tag}
            className="anim-chip inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-full p-0.5 hover:bg-primary/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          aria-label="Add a tag"
          className="min-w-[7rem] flex-1 bg-transparent py-0.5 text-sm text-text-main outline-none placeholder:text-text-muted"
        />
      </div>

      {open && total > 0 && (
        <div className="anim-pop absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-background p-1.5 shadow-2xl">
          {!typed && (
            <p className="px-3 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
              Popular
            </p>
          )}
          {suggestions.map((t, i) => (
            <button
              key={t.tag}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => add(t.tag)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${i === active ? 'bg-primary/10' : ''}`}
            >
              <span className="text-text-main">
                <span className="text-text-muted">#</span>
                {typed && t.tag.includes(typed) ? (
                  <>
                    {t.tag.slice(0, t.tag.indexOf(typed))}
                    <b className="text-primary">{typed}</b>
                    {t.tag.slice(t.tag.indexOf(typed) + typed.length)}
                  </>
                ) : (
                  t.tag
                )}
              </span>
              <span className="text-xs text-text-muted">{t.count}×</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseEnter={() => setActive(suggestions.length)}
              onClick={() => add(typed)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-primary ${active === suggestions.length ? 'bg-primary/10' : ''}`}
            >
              Create <b>#{typed}</b>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
