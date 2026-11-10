import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, Loader2, Repeat, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createExpenseMutation,
  createRecurringMutation,
  updateExpenseMutation,
  getCurrentUserOptions,
  getWorkspaceMembersOptions,
  getWorkspaceOptions,
} from '../../../api/@tanstack/react-query.gen';
import type { Expense } from '../../../api/types.gen';
import { ExpenseComments } from './ExpenseComments';
import { Sheet } from '../../../components/ui/Sheet';
import { CategoryManager } from '../../categories/CategoryManager';
import { CategoryPicker } from '../../categories/CategoryPicker';
import { suggestCategoryName } from '../../categories/suggest';
import { categoryStyle, useCategories } from '../../categories/useCategories';
import { CurrencySelect } from '../../currency/CurrencySelect';
import { TagInput } from '../../tags/TagInput';
import {
  fractionDigits,
  formatCurrency,
  getCurrencySymbol,
  inputStep,
  sameAmount,
} from '../../../utils/currency';

type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';
type Repeat = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

const SPLIT_LABELS: Record<SplitType, string> = {
  EQUAL: 'Equally',
  EXACT: 'Exact amounts',
  PERCENTAGE: 'Percentages',
};
const REPEAT_LABELS: Record<Repeat, string> = {
  NONE: 'Never repeats',
  DAILY: 'Every day',
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
};

const todayISO = () => new Date().toISOString().split('T')[0];

const friendlyDate = (iso: string) => {
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/** Keeps only what the currency can hold: digits and, if it has decimals, one separator. */
const cleanAmount = (raw: string, currency: string) => {
  const digits = fractionDigits(currency);
  const [whole, ...rest] = raw
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
    .split('.');
  if (digits === 0 || rest.length === 0) return whole;
  return `${whole}.${rest.join('').slice(0, digits)}`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={categoryStyle(name)}
    >
      {initials(name)}
    </span>
  );
}

/** A pill whose face shows the current choice while a transparent native select does the work. */
function SelectPill({
  icon,
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  ariaLabel: string;
}) {
  return (
    <label className="pill relative cursor-pointer">
      {icon}
      <span className="max-w-[9rem] truncate">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

const Section = ({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="space-y-2.5">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

export const AddExpenseModal: React.FC<Props> = ({ isOpen, onClose, workspaceId }) =>
  isOpen ? <ExpenseSheet onClose={onClose} workspaceId={workspaceId} /> : null;

const ALL_AMOUNT_TYPES: SplitType[] = ['EQUAL', 'EXACT', 'PERCENTAGE'];

/** One form for both adding and editing, so the two always look and behave the same. */
export function ExpenseSheet({
  onClose,
  workspaceId,
  expense,
}: Omit<Props, 'isOpen'> & { expense?: Expense }) {
  const editing = !!expense;
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery(getWorkspaceMembersOptions({ path: { workspaceId } }));
  const { data: workspace } = useQuery(getWorkspaceOptions({ path: { workspaceId } }));
  const { data: me } = useQuery(getCurrentUserOptions());
  const { categories } = useCategories(workspaceId);
  const createExpense = useMutation(createExpenseMutation());
  const createRecurring = useMutation(createRecurringMutation());
  const updateExpense = useMutation(updateExpenseMutation());

  const [amountText, setAmountText] = useState(() =>
    expense ? String(Number(expense.amount)) : '',
  );
  const [currency, setCurrency] = useState(
    expense?.currency ?? workspace?.defaultCurrency ?? 'USD',
  );
  const [description, setDescription] = useState(expense?.description ?? '');
  const [date, setDate] = useState(() => expense?.date.slice(0, 10) ?? todayISO());
  const [category, setCategory] = useState(expense?.category ?? 'Other');
  const [categoryTouched, setCategoryTouched] = useState(editing);
  const [tags, setTags] = useState<string[]>(expense?.tags ?? []);
  const [repeat, setRepeat] = useState<Repeat>('NONE');
  const [managing, setManaging] = useState(false);

  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? '');
  const [multiplePayers, setMultiplePayers] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, number>>({});

  const [splitType, setSplitType] = useState<SplitType>(
    ALL_AMOUNT_TYPES.includes(expense?.splitType as SplitType)
      ? (expense?.splitType as SplitType)
      : 'EQUAL',
  );
  const [participants, setParticipants] = useState<string[]>(
    () => expense?.splits?.map((x) => x.userId) ?? [],
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries((expense?.splits ?? []).map((x) => [x.userId, Number(x.amountOwed)])),
  );
  const [percentages, setPercentages] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (expense?.splits ?? []).map((x) => [
        x.userId,
        expense && Number(expense.amount)
          ? Math.round((Number(x.amountOwed) / Number(expense.amount)) * 10_000) / 100
          : 0,
      ]),
    ),
  );

  // Members and the workspace load after the sheet opens; fill the defaults once, when they do.
  const seeded = useRef({ members: false, currency: false });
  useEffect(() => {
    if (editing) return; // an existing expense keeps its own payer, people and currency
    if (!seeded.current.members && members.length > 0) {
      seeded.current.members = true;
      setParticipants(members.map((m) => m.id));
      setPaidBy(me?.id && members.some((m) => m.id === me.id) ? me.id : members[0].id);
    }
    if (!seeded.current.currency && workspace?.defaultCurrency) {
      seeded.current.currency = true;
      setCurrency(workspace.defaultCurrency);
    }
  }, [members, workspace, me, editing]);

  // Until the user picks one, the description chooses the category.
  const suggested = useMemo(
    () =>
      suggestCategoryName(
        description,
        categories.map((c) => c.name),
      ),
    [description, categories],
  );
  useEffect(() => {
    if (!categoryTouched && suggested) setCategory(suggested);
  }, [suggested, categoryTouched]);

  const amount = Number.parseFloat(amountText) || 0;
  const nameOf = (id: string) =>
    id === me?.id ? 'You' : (members.find((m) => m.id === id)?.name ?? '?');

  const exactSum = participants.reduce((sum, id) => sum + (exactAmounts[id] || 0), 0);
  const percentSum = participants.reduce((sum, id) => sum + (percentages[id] || 0), 0);
  const payerSum = Object.values(payerAmounts).reduce((sum, a) => sum + (a || 0), 0);

  const problem = (() => {
    if (!amount) return 'Enter an amount';
    if (!description.trim()) return 'Add a description';
    if (participants.length === 0) return 'Pick who shares this';
    if (multiplePayers && !sameAmount(payerSum, amount, currency)) {
      const diff = amount - payerSum;
      return `${formatCurrency(Math.abs(diff), currency)} ${diff > 0 ? 'left to assign to payers' : 'over'}`;
    }
    if (splitType === 'EXACT' && !sameAmount(exactSum, amount, currency)) {
      const diff = amount - exactSum;
      return `${formatCurrency(Math.abs(diff), currency)} ${diff > 0 ? 'left to split' : 'over'}`;
    }
    if (splitType === 'PERCENTAGE' && Math.abs(percentSum - 100) >= 0.01) {
      return `${Math.abs(100 - percentSum).toFixed(0)}% ${percentSum < 100 ? 'left' : 'over'}`;
    }
    return null;
  })();

  const summary =
    splitType === 'EQUAL' && participants.length > 0 && amount
      ? `Split equally between ${participants.length} · ${formatCurrency(amount / participants.length, currency)} each`
      : amount
        ? `${formatCurrency(amount, currency)} · ${SPLIT_LABELS[splitType].toLowerCase()}`
        : 'Add an amount to split';

  const pending = createExpense.isPending || createRecurring.isPending || updateExpense.isPending;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (problem || pending) return;

    const payers = multiplePayers
      ? Object.entries(payerAmounts)
          .filter(([, a]) => a > 0)
          .map(([userId, a]) => ({ userId, amount: a }))
      : [{ userId: paidBy, amount }];
    const exact =
      splitType === 'EXACT'
        ? participants.map((userId) => ({ userId, amount: exactAmounts[userId] || 0 }))
        : undefined;
    const percent =
      splitType === 'PERCENTAGE'
        ? participants.map((userId) => ({ userId, percentage: percentages[userId] || 0 }))
        : undefined;

    try {
      if (expense) {
        await updateExpense.mutateAsync({
          path: { expenseId: expense.id },
          body: {
            description: description.trim(),
            amount,
            date,
            splitType,
            paidBy,
            participants,
            category,
            tags,
            currency,
            exactAmounts: exact,
            percentages: percent,
            expectedVersion: expense.version,
          } as never,
        });
      } else if (repeat !== 'NONE') {
        // A repeating expense is a rule: the server creates this one now and the next ones on schedule.
        await createRecurring.mutateAsync({
          path: { workspaceId },
          body: {
            description: description.trim(),
            amount,
            currency,
            startDate: new Date(date).toISOString(),
            interval: repeat,
            splitType,
            tags,
            payers,
            participants,
            exactAmounts: exact,
            percentages: percent,
          } as never,
        });
      } else {
        await createExpense.mutateAsync({
          path: { workspaceId },
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: {
            description: description.trim(),
            amount,
            date,
            splitType,
            payers,
            category,
            tags,
            currency,
            type: 'EXPENSE',
            participants,
            exactAmounts: exact,
            percentages: percent,
          },
        });
      }
      // Refresh in the background: the sheet closes as soon as the server has saved it.
      void queryClient.invalidateQueries();
      toast.success(
        editing
          ? 'Changes saved'
          : repeat === 'NONE'
            ? 'Expense added'
            : 'Recurring expense set up',
      );
      onClose();
    } catch {
      toast.error('Could not save the expense. Please try again.');
    }
  };

  const symbol = getCurrencySymbol(currency);

  const numberBox = (
    value: number | undefined,
    onChange: (n: number) => void,
    prefix?: string,
    suffix?: string,
  ) => (
    <div className="relative w-28 shrink-0">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
          {prefix}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        step={suffix ? 1 : inputStep(currency)}
        min="0"
        value={value || ''}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        placeholder="0"
        className={`field py-1.5 text-right ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
          {suffix}
        </span>
      )}
    </div>
  );

  return (
    <>
      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          // The sheet renders in a portal, outside this form's DOM, so Enter is handled here.
          const target = e.target as HTMLInputElement;
          const enterInField =
            e.key === 'Enter' && target.tagName === 'INPUT' && target.type !== 'date';
          if (
            e.key === 'Enter' &&
            (e.metaKey || e.ctrlKey || enterInField) &&
            !e.defaultPrevented
          ) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <Sheet
          title={editing ? 'Edit expense' : 'New expense'}
          subtitle={workspace?.name}
          onClose={onClose}
          footer={
            <div className="space-y-3">
              <p
                aria-live="polite"
                className={`text-center text-sm ${problem ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}`}
              >
                {problem ?? summary}
              </p>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!!problem || pending}
                className="btn-primary w-full py-3.5 text-base"
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {pending
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    : repeat === 'NONE'
                      ? 'Add expense'
                      : 'Start recurring expense'}
                {!pending && (
                  <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-0.5 text-xs font-normal sm:inline">
                    ⌘↵
                  </kbd>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-7 pt-1">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-display text-3xl text-text-muted">{symbol}</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(cleanAmount(e.target.value, currency))}
                  placeholder="0"
                  aria-label="Amount"
                  size={Math.max(amountText.length, 1)}
                  className="min-w-[1ch] max-w-full bg-transparent text-center font-display text-6xl font-semibold tabular-nums text-text-main outline-none focus-visible:outline-none placeholder:text-border"
                />
              </div>
              <CurrencySelect
                value={currency}
                onChange={(c) => {
                  setCurrency(c);
                  setAmountText((t) => cleanAmount(t, c));
                }}
                className="field cursor-pointer"
              />
            </div>

            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was it for?"
              aria-label="Description"
              maxLength={255}
              className="field w-full"
            />

            <div className="flex flex-wrap gap-2">
              <CategoryPicker
                workspaceId={workspaceId}
                value={category}
                onChange={(c) => {
                  setCategory(c);
                  setCategoryTouched(true);
                }}
                onManage={() => setManaging(true)}
              />
              <label className="pill relative cursor-pointer">
                <Calendar className="h-4 w-4 text-text-muted" />
                {friendlyDate(date)}
                <input
                  type="date"
                  value={date}
                  max="2100-01-01"
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  aria-label="Date"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              {!editing && (
                <SelectPill
                  icon={<Repeat className="h-4 w-4 text-text-muted" />}
                  label={REPEAT_LABELS[repeat]}
                  value={repeat}
                  onChange={(v) => setRepeat(v as Repeat)}
                  options={Object.entries(REPEAT_LABELS)}
                  ariaLabel="Repeats"
                />
              )}
            </div>

            <Section title="Tags">
              <TagInput
                workspaceId={workspaceId}
                value={tags}
                onChange={setTags}
                placeholder="trip, dinner, rent…"
              />
            </Section>

            <Section title="Paid by">
              <div className="flex flex-wrap gap-2">
                <SelectPill
                  icon={<Users className="h-4 w-4 text-text-muted" />}
                  label={multiplePayers ? 'Multiple people' : `${nameOf(paidBy)} paid`}
                  value={multiplePayers ? '__multiple__' : paidBy}
                  onChange={(v) => {
                    if (v === '__multiple__') setMultiplePayers(true);
                    else {
                      setMultiplePayers(false);
                      setPaidBy(v);
                    }
                  }}
                  options={[
                    ...members.map((m): [string, string] => [
                      m.id,
                      m.id === me?.id ? 'You' : m.name,
                    ]),
                    ...(editing ? [] : [['__multiple__', 'Multiple people…'] as [string, string]]),
                  ]}
                  ariaLabel="Paid by"
                />
              </div>
              {multiplePayers && (
                <div className="anim-pop space-y-2 rounded-2xl border border-border bg-surface p-3">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <span className="flex-1 truncate text-sm text-text-main">{nameOf(m.id)}</span>
                      {numberBox(
                        payerAmounts[m.id],
                        (n) => setPayerAmounts((p) => ({ ...p, [m.id]: n })),
                        symbol,
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Split"
              aside={
                <span className="text-xs text-text-muted">
                  <button
                    type="button"
                    onClick={() => setParticipants(members.map((m) => m.id))}
                    className="hover:text-primary"
                  >
                    Everyone
                  </button>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setParticipants([])}
                    className="hover:text-primary"
                  >
                    Nobody
                  </button>
                </span>
              }
            >
              <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
                {(Object.keys(SPLIT_LABELS) as SplitType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={splitType === type}
                    onClick={() => setSplitType(type)}
                    className={`press rounded-xl py-2 text-sm font-medium transition-all ${splitType === type ? 'bg-background text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                  >
                    {SPLIT_LABELS[type]}
                  </button>
                ))}
              </div>

              <ul className="divide-y divide-border/60">
                {members.map((m) => {
                  const on = participants.includes(m.id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setParticipants((p) =>
                            p.includes(m.id) ? p.filter((id) => id !== m.id) : [...p, m.id],
                          )
                        }
                        aria-pressed={on}
                        aria-label={`${on ? 'Remove' : 'Include'} ${m.name}`}
                        className="press flex flex-1 items-center gap-3 text-left"
                      >
                        <span className="relative">
                          <Avatar name={m.name} />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background text-white transition-all ${on ? 'scale-100 bg-primary' : 'scale-0'}`}
                          >
                            <Check className="h-2.5 w-2.5" strokeWidth={4} />
                          </span>
                        </span>
                        <span
                          className={`truncate text-sm ${on ? 'text-text-main' : 'text-text-muted'}`}
                        >
                          {nameOf(m.id)}
                        </span>
                      </button>
                      {on && splitType === 'EQUAL' && amount > 0 && (
                        <span className="text-sm tabular-nums text-text-muted">
                          {formatCurrency(amount / participants.length, currency)}
                        </span>
                      )}
                      {on &&
                        splitType === 'EXACT' &&
                        numberBox(
                          exactAmounts[m.id],
                          (n) => setExactAmounts((p) => ({ ...p, [m.id]: n })),
                          symbol,
                        )}
                      {on &&
                        splitType === 'PERCENTAGE' &&
                        numberBox(
                          percentages[m.id],
                          (n) => setPercentages((p) => ({ ...p, [m.id]: n })),
                          undefined,
                          '%',
                        )}
                    </li>
                  );
                })}
              </ul>
            </Section>
            {expense && <ExpenseComments expenseId={expense.id} />}
          </div>
        </Sheet>
      </form>
      {managing && <CategoryManager workspaceId={workspaceId} onClose={() => setManaging(false)} />}
    </>
  );
}
