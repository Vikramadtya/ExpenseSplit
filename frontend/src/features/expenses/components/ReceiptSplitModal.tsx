import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Plus, Receipt, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { client } from '../../../api/client.gen';
import { getFreshAccessToken } from '../../../auth/session';
import {
  createExpenseMutation,
  getCurrentUserOptions,
  getWorkspaceMembersOptions,
  getWorkspaceOptions,
} from '../../../api/@tanstack/react-query.gen';
import { formatCurrency, fromMinor, toMinor } from '../../../utils/currency';
import { CurrencySelect } from '../../currency/CurrencySelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface Line {
  key: number;
  name: string;
  amount: string;
  assignees: string[];
}

interface ScanResult {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: { name: string; amount: number }[];
  tax: number;
  tip: number;
  mismatch: boolean;
  suggestedCategory: string;
}

interface ReceiptResponse {
  id: string;
  status: 'PROCESSING' | 'DONE' | 'FAILED';
  result: ScanResult | null;
  error: string | null;
}

const authHeader = async () => ({ Authorization: `Bearer ${await getFreshAccessToken()}` });

async function uploadReceipt(workspaceId: string, file: File): Promise<ReceiptResponse> {
  const base = client.getConfig().baseUrl;
  const res = await fetch(`${base}/workspaces/${workspaceId}/receipts`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok)
    throw new Error(res.status === 400 ? 'That is not a photo we can read' : 'Upload failed');
  return res.json();
}

/** Waits for the background scan to finish (it usually takes a few seconds). */
async function waitForScan(workspaceId: string, id: string): Promise<ReceiptResponse> {
  const base = client.getConfig().baseUrl;
  for (let attempt = 0; attempt < 75; attempt++) {
    const res = await fetch(`${base}/workspaces/${workspaceId}/receipts/${id}`, {
      headers: await authHeader(),
    });
    const receipt: ReceiptResponse = await res.json();
    if (receipt.status !== 'PROCESSING') return receipt;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error('Scanning is taking too long');
}

export function ReceiptSplitModal({ isOpen, onClose, workspaceId }: Props) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);

  const { data: members = [] } = useQuery(getWorkspaceMembersOptions({ path: { workspaceId } }));
  const { data: workspace } = useQuery(getWorkspaceOptions({ path: { workspaceId } }));
  const { data: me } = useQuery(getCurrentUserOptions());
  const create = useMutation(createExpenseMutation());

  const [stage, setStage] = useState<'pick' | 'scanning' | 'edit'>('pick');
  const [notice, setNotice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [currency, setCurrency] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [tax, setTax] = useState('');
  const [tip, setTip] = useState('');

  if (!isOpen) return null;

  const everyone = members.map((m) => m.id);
  const newLine = (name = '', amount = ''): Line => ({
    key: nextKey.current++,
    name,
    amount,
    assignees: everyone,
  });
  const effectiveCurrency = currency || workspace?.defaultCurrency || 'USD';
  const payer = paidBy || me?.id || '';

  const minor = (value: string | number) => toMinor(value, effectiveCurrency);
  const subtotal = lines.reduce((sum, l) => sum + minor(l.amount), 0);
  const total = subtotal + minor(tax) + minor(tip);
  const linesValid =
    lines.length > 0 &&
    lines.every((l) => l.name.trim() && minor(l.amount) > 0 && l.assignees.length > 0);
  const canSave = Boolean(description.trim() && linesValid && total > 0 && payer);

  const startManual = (message = '') => {
    setNotice(message);
    setLines([newLine()]);
    setStage('edit');
  };

  const handleFile = async (file: File) => {
    setStage('scanning');
    try {
      const accepted = await uploadReceipt(workspaceId, file);
      const receipt = await waitForScan(workspaceId, accepted.id);
      if (receipt.status !== 'DONE' || !receipt.result) {
        startManual("We couldn't read that receipt. Add the items by hand.");
        return;
      }
      const r = receipt.result;
      setDescription(r.merchant ?? '');
      setCategory(r.suggestedCategory);
      if (r.currency) setCurrency(r.currency);
      if (r.date) setDate(r.date);
      setTax(r.tax ? String(r.tax) : '');
      setTip(r.tip ? String(r.tip) : '');
      setLines(r.items.map((i) => newLine(i.name, String(i.amount))));
      setNotice(
        r.mismatch ? 'The lines do not add up to the printed total. Please check them.' : '',
      );
      setStage('edit');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not scan the receipt');
      setStage('pick');
    }
  };

  const toggle = (line: Line, userId: string) =>
    setLines(
      lines.map((l) =>
        l.key === line.key
          ? {
              ...l,
              assignees: l.assignees.includes(userId)
                ? l.assignees.filter((id) => id !== userId)
                : [...l.assignees, userId],
            }
          : l,
      ),
    );

  const patch = (key: number, change: Partial<Line>) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));

  const save = async () => {
    await create.mutateAsync({
      path: { workspaceId },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: {
        description: description.trim(),
        amount: fromMinor(total, effectiveCurrency),
        currency: effectiveCurrency,
        category,
        date,
        splitType: 'ITEMIZED',
        payers: [{ userId: payer, amount: fromMinor(total, effectiveCurrency) }],
        items: lines.map((l) => ({
          name: l.name.trim(),
          amount: fromMinor(minor(l.amount), effectiveCurrency),
          assignees: l.assignees,
        })),
        tax: fromMinor(minor(tax), effectiveCurrency),
        tip: fromMinor(minor(tip), effectiveCurrency),
      } as any,
    });
    queryClient.invalidateQueries();
    toast.success('Expense added');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-500" />
            Split a receipt
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-zinc-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'pick' && (
          <div className="p-8 text-center space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Take or choose a photo of the receipt. We read the items, then you tap who had what.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Choose a photo
            </button>
            <div>
              <button
                onClick={() => startManual()}
                className="text-sm text-indigo-600 hover:underline"
              >
                Enter items by hand
              </button>
            </div>
          </div>
        )}

        {stage === 'scanning' && (
          <div className="p-12 text-center text-zinc-600 dark:text-zinc-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            Reading your receipt…
          </div>
        )}

        {stage === 'edit' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) void save();
            }}
            className="p-6 space-y-5"
          >
            {notice && (
              <p className="text-sm rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 px-3 py-2">
                {notice}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                What was it?
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field mt-1 block w-full"
                  placeholder="Joe's Pizza"
                  required
                />
              </label>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Currency
                <CurrencySelect
                  value={effectiveCurrency}
                  onChange={setCurrency}
                  className="input-field mt-1 block w-full"
                />
              </label>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Paid by
                <select
                  value={payer}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="input-field mt-1 block w-full"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ul className="space-y-3">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      value={line.name}
                      onChange={(e) => patch(line.key, { name: e.target.value })}
                      placeholder="Item"
                      aria-label="Item name"
                      className="input-field flex-1 min-w-0"
                    />
                    <input
                      value={line.amount}
                      onChange={(e) => patch(line.key, { amount: e.target.value })}
                      placeholder="0.00"
                      aria-label="Item price"
                      inputMode="decimal"
                      className="input-field w-24 text-right"
                    />
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                      aria-label="Remove item"
                      className="p-2 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const on = line.assignees.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => toggle(line, m.id)}
                          aria-pressed={on}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'text-zinc-500 border-zinc-300 dark:border-zinc-700'}`}
                        >
                          {m.name.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setLines([...lines, newLine()])}
              className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add item
            </button>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Tax
                <input
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input-field mt-1 block w-full"
                />
              </label>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Tip
                <input
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input-field mt-1 block w-full"
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Tax and tip are shared in proportion to what each person ordered.
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Total{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(fromMinor(total, effectiveCurrency), effectiveCurrency)}
                </strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-xl text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSave || create.isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl"
                >
                  Save expense
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
