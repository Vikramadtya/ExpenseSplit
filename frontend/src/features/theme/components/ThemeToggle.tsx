import { useThemeStore } from '../store';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/50 transition-all shadow-sm focus:outline-none"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Sun className="w-5 h-5" />
        ) : theme === 'dark' ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Monitor className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 glass-panel overflow-hidden z-50 animate-fade-in origin-top-right">
          <div className="flex flex-col p-1">
            <button
              onClick={() => {
                setTheme('light');
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'light' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button
              onClick={() => {
                setTheme('dark');
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'dark' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              onClick={() => {
                setTheme('system');
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'system' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
            >
              <Monitor className="w-4 h-4" />
              System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
