import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { client } from '../../api/client.gen';
import { clearSession, getFreshAccessToken } from '../../auth/session';

interface Blocker {
  workspace: string;
  reason: string;
}

const call = async (path: string, init: RequestInit = {}) =>
  fetch(`${client.getConfig().baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${await getFreshAccessToken()}`,
    },
  });

/** Your data, in your hands: download a copy, or delete the account. */
export function AccountSettings() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const res = await call('/users/me/export');
    if (!res.ok) return toast.error('Could not export your data');
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement('a'), {
      href: url,
      download: 'expensesplit-my-data.json',
    }).click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await call('/users/me', { method: 'DELETE', body: JSON.stringify({ confirm }) });
      if (res.status === 204) {
        clearSession();
        window.location.assign('/login');
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) toast.error('Too many attempts. Try again later.');
      else if (body.blockers) setBlockers(body.blockers);
      else toast.error(body.message ?? 'Could not delete the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-panel p-5 rounded-2xl mb-6">
      <h2 className="font-semibold text-text-main">Your account</h2>
      <p className="text-sm text-text-muted mb-4">
        Download everything we hold about you, or delete your account.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={download}
          className="flex items-center gap-2 bg-surface border border-border text-text-muted hover:text-text-main font-medium py-2 px-3 rounded-lg text-sm"
        >
          <Download className="w-4 h-4" /> Download my data
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium py-2 px-3 rounded-lg text-sm"
        >
          <Trash2 className="w-4 h-4" /> Delete account
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-text-muted">
            Your name and details are erased. Expenses you shared stay in your groups so
            everyone&apos;s balances remain correct, shown as &quot;Deleted user&quot;. This cannot
            be undone.
          </p>
          {blockers.length > 0 && (
            <ul className="rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 px-3 py-2 space-y-1">
              {blockers.map((b) => (
                <li key={b.workspace}>
                  <strong>{b.workspace}:</strong> {b.reason}
                </li>
              ))}
            </ul>
          )}
          <label className="block text-text-muted">
            Type DELETE to confirm
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field mt-1 block w-full max-w-xs"
              autoComplete="off"
            />
          </label>
          <button
            onClick={remove}
            disabled={confirm !== 'DELETE' || busy}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl"
          >
            Permanently delete my account
          </button>
        </div>
      )}
    </section>
  );
}
