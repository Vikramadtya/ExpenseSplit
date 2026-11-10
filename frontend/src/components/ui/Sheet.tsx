import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Open sheets, topmost last: Escape closes only the one on top. */
const openSheets: symbol[] = [];

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling body (primary actions). */
  footer?: ReactNode;
  /** Tailwind max-width class for desktop. */
  width?: string;
}

/** A bottom sheet on phones and a centred dialog on larger screens, with enter/exit motion. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'sm:max-w-xl',
}: Props) {
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    const id = Symbol('sheet');
    openSheets.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && openSheets[openSheets.length - 1] === id) {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(id), 1);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm ${closing ? 'sheet-closing' : 'anim-fade'}`}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={`sheet-panel flex w-full ${width} max-h-[94dvh] sm:max-h-[90vh] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border bg-background shadow-2xl`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <header className="flex items-start justify-between gap-4 px-6 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-text-main">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="press -mr-2 rounded-full p-2 text-text-muted hover:bg-surface hover:text-text-main"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4">{children}</div>
        {footer && (
          <footer className="border-t border-border bg-background/95 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
