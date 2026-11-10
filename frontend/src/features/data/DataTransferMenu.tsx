import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { client } from '../../api/client.gen';
import { getFreshAccessToken } from '../../auth/session';

interface ImportReport {
  expenses: number;
  payments: number;
  skippedDuplicates: number;
  dryRun: boolean;
  errors: { line: number; message: string }[];
}

interface Unmatched {
  unmatched: string[];
  members: { id: string; name: string }[];
}

const call = async (path: string, init: RequestInit = {}) =>
  fetch(`${client.getConfig().baseUrl}/workspaces/${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await getFreshAccessToken()}` },
  });

/** Download your data as CSV, or bring a Splitwise export in (with a preview first). */
export function DataTransferMenu({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [unmatched, setUnmatched] = useState<Unmatched | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const res = await call(`${workspaceId}/export.csv`);
    if (!res.ok) return toast.error('Could not export');
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'expenses.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async (text: string, dryRun: boolean, map: Record<string, string>) => {
    setBusy(true);
    try {
      const query = new URLSearchParams();
      if (dryRun) query.set('dryRun', 'true');
      if (Object.keys(map).length) query.set('mapping', JSON.stringify(map));
      const res = await call(`${workspaceId}/import/splitwise?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      const body = await res.json();
      if (res.status === 400 && body.unmatched) return setUnmatched(body as Unmatched);
      if (!res.ok) return toast.error(body.message ?? 'Import failed');
      setUnmatched(null);
      setReport(body as ImportReport);
      if (!dryRun) {
        queryClient.invalidateQueries();
        toast.success(`Imported ${body.expenses} expenses and ${body.payments} payments`);
      }
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setReport(null);
    setUnmatched(null);
    setMapping({});
    await run(text, true, {});
  };

  const close = () => {
    setCsv(null);
    setReport(null);
    setUnmatched(null);
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={download}
          className="flex items-center gap-2 bg-surface border border-border text-text-muted hover:text-text-main font-medium py-2 px-3 rounded-lg text-sm"
        >
          <Download className="w-4 h-4" /> Export
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 bg-surface border border-border text-text-muted hover:text-text-main font-medium py-2 px-3 rounded-lg text-sm"
        >
          <Upload className="w-4 h-4" /> Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void pick(file);
          }}
        />
      </div>

      {csv !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-main">Import from Splitwise</h2>
              <button
                onClick={close}
                aria-label="Close"
                className="p-1 text-text-muted hover:text-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {unmatched && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Who are these people in this workspace?
                </p>
                {unmatched.unmatched.map((name) => (
                  <label
                    key={name}
                    className="flex items-center justify-between gap-3 text-sm text-text-main"
                  >
                    {name}
                    <select
                      value={mapping[name] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [name]: e.target.value })}
                      className="field w-44"
                    >
                      <option value="">Choose…</option>
                      {unmatched.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  disabled={busy || unmatched.unmatched.some((n) => !mapping[n])}
                  onClick={() => run(csv, true, mapping)}
                  className="btn-primary"
                >
                  Preview
                </button>
              </div>
            )}

            {report && (
              <div className="space-y-3 text-sm text-text-main">
                <p>
                  {report.dryRun ? 'Ready to import' : 'Imported'}{' '}
                  <strong>{report.expenses}</strong> expenses and <strong>{report.payments}</strong>{' '}
                  payments.
                  {report.skippedDuplicates > 0 &&
                    ` ${report.skippedDuplicates} already here and skipped.`}
                </p>
                {report.errors.length > 0 && (
                  <ul className="text-amber-700 dark:text-amber-400 space-y-1">
                    {report.errors.slice(0, 5).map((e) => (
                      <li key={e.line}>
                        Line {e.line}: {e.message}
                      </li>
                    ))}
                    {report.errors.length > 5 && <li>…and {report.errors.length - 5} more</li>}
                  </ul>
                )}
                {report.dryRun ? (
                  <button
                    disabled={busy || report.expenses + report.payments === 0}
                    onClick={() => run(csv, false, mapping)}
                    className="btn-primary"
                  >
                    Import now
                  </button>
                ) : (
                  <button onClick={close} className="btn-primary">
                    Done
                  </button>
                )}
              </div>
            )}

            {!unmatched && !report && <p className="text-sm text-text-muted">Reading the file…</p>}
          </div>
        </div>
      )}
    </>
  );
}
