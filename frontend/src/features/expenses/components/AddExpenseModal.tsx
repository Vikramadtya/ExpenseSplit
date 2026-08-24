import React, { useState, useEffect } from 'react';
import { ALL_CATEGORIES } from '../../../utils/constants';
type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWorkspaceMembersOptions,
  getWorkspaceOptions,
  createExpenseMutation,
} from '../../../api/@tanstack/react-query.gen';

import { X, Receipt, DollarSign, Calendar, User, Tag } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Food & Drink': '🍽️',
  Transport: '🚗',
  Accommodation: '🏠',
  Entertainment: '🎬',
  Groceries: '🛒',
  Utilities: '💡',
  Health: '❤️',
  Shopping: '🛍️',
  Other: '📦',
};

export const AddExpenseModal: React.FC<Props> = ({ isOpen, onClose, workspaceId }) => {
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery(getWorkspaceMembersOptions({ path: { workspaceId } }));
  const { data: workspace } = useQuery(getWorkspaceOptions({ path: { workspaceId } }));
  const mutation = useMutation(createExpenseMutation());

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('Other');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [currency, setCurrency] = useState('USD');

  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [participants, setParticipants] = useState<string[]>([]);

  const [isMultiplePayers, setIsMultiplePayers] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, number>>({});

  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      setPaidBy(members[0]?.id || '');
      setParticipants(members.map((m) => m.id));
      setExactAmounts({});
      setPercentages({});
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategory('Other');
      setTags([]);
      setTagInput('');
      setSplitType('EQUAL');
      setCurrency('USD');
      setIsMultiplePayers(false);
      setPayerAmounts({});
    }
  }, [isOpen, members, workspace]);

  if (!isOpen) return null;

  const handleParticipantToggle = (memberId: string) => {
    setParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const handleExactAmountChange = (memberId: string, value: string) => {
    setExactAmounts((prev) => ({ ...prev, [memberId]: parseFloat(value) || 0 }));
  };

  const handlePercentageChange = (memberId: string, value: string) => {
    setPercentages((prev) => ({ ...prev, [memberId]: parseFloat(value) || 0 }));
  };

  const exactSum = participants.reduce((sum, id) => sum + (exactAmounts[id] || 0), 0);
  const percentSum = participants.reduce((sum, id) => sum + (percentages[id] || 0), 0);

  const numAmount = typeof amount === 'number' ? amount : 0;

  const handlePayerAmountChange = (memberId: string, value: string) => {
    setPayerAmounts((prev) => ({ ...prev, [memberId]: parseFloat(value) || 0 }));
  };

  const payerSum = Object.values(payerAmounts).reduce((sum, amt) => sum + (amt || 0), 0);
  const payerValid = !isMultiplePayers || Math.abs(payerSum - numAmount) < 0.01;

  const exactValid = Math.abs(exactSum - numAmount) < 0.01;
  const percentValid = Math.abs(percentSum - 100) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || (!isMultiplePayers && !paidBy) || participants.length === 0)
      return;

    if (splitType === 'EXACT' && !exactValid) return;
    if (splitType === 'PERCENTAGE' && !percentValid) return;
    if (isMultiplePayers && !payerValid) return;

    const payers = isMultiplePayers
      ? Object.entries(payerAmounts)
          .filter(([_, amt]) => amt > 0)
          .map(([userId, amount]) => ({ userId, amount }))
      : [{ userId: paidBy, amount: Number(amount) }];

    await mutation.mutateAsync({
      path: { workspaceId },
      body: {
        description,
        amount: Number(amount),
        date,
        splitType,
        groupId: workspaceId,
        payers,
        category,
        tags,
        currency,
        type: 'EXPENSE',
        exactAmounts:
          splitType === 'EXACT'
            ? Object.entries(exactAmounts).map(([userId, amount]) => ({ userId, amount }))
            : undefined,
        percentages:
          splitType === 'PERCENTAGE'
            ? Object.entries(percentages).map(([userId, percentage]) => ({ userId, percentage }))
            : undefined,
      } as any,
    });

    queryClient.invalidateQueries();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-500" />
            Add Expense
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Dinner, Uber, etc."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || '')}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Category
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none"
                  >
                    {ALL_CATEGORIES.map((c: any) => (
                      <option key={c} value={c}>
                        {CATEGORY_ICONS[c]} {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tags (press Enter to add)
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <div className="w-full min-h-[46px] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none flex flex-wrap gap-2 items-center">
                  {tags.map((tag, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-md text-xs font-medium border border-indigo-200 dark:border-indigo-800"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setTags((prev) => prev.filter((_, index) => index !== i))}
                        className="hover:text-indigo-900 dark:hover:text-indigo-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const newTag = tagInput.trim().replace(/^#/, '');
                        if (newTag && !tags.includes(newTag)) {
                          setTags((prev) => [...prev, newTag]);
                        }
                        setTagInput('');
                      } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                        setTags((prev) => prev.slice(0, -1));
                      }
                    }}
                    placeholder={tags.length === 0 ? 'trip2024, dinner...' : ''}
                    className="flex-1 bg-transparent min-w-[120px] outline-none text-sm py-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Paid By
                </label>
                <button
                  type="button"
                  onClick={() => setIsMultiplePayers(!isMultiplePayers)}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                >
                  {isMultiplePayers ? 'Single Payer' : 'Multiple Payers'}
                </button>
              </div>

              {!isMultiplePayers ? (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    required={!isMultiplePayers}
                  >
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  {members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 text-zinc-700 dark:text-zinc-300 truncate">
                        {m.name}
                      </span>
                      <div className="relative w-24">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payerAmounts[m.id] || ''}
                          onChange={(e) => handlePayerAmountChange(m.id, e.target.value)}
                          className="w-full text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 pl-7 pr-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                  <div
                    className={`mt-2 text-xs p-2 rounded-md ${payerValid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                  >
                    Paid: ${payerSum.toFixed(2)} / ${numAmount.toFixed(2)} {payerValid ? '✓' : '✗'}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Split Type
              </label>
              <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                {(['EQUAL', 'EXACT', 'PERCENTAGE'] as SplitType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${splitType === type ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Participants
                </label>
                <div className="text-xs text-zinc-500">
                  <button
                    type="button"
                    onClick={() => setParticipants(members.map((m: any) => m.id))}
                    className="hover:text-indigo-500 mr-2"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipants([])}
                    className="hover:text-indigo-500"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleParticipantToggle(m.id)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${participants.includes(m.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}
                    >
                      {participants.includes(m.id) && (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm flex-1 text-zinc-700 dark:text-zinc-300">
                      {m.name}
                    </span>

                    {participants.includes(m.id) && splitType === 'EXACT' && (
                      <div className="relative w-24">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={exactAmounts[m.id] || ''}
                          onChange={(e) => handleExactAmountChange(m.id, e.target.value)}
                          className="w-full text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 pl-7 pr-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    )}

                    {participants.includes(m.id) && splitType === 'PERCENTAGE' && (
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={percentages[m.id] || ''}
                          onChange={(e) => handlePercentageChange(m.id, e.target.value)}
                          className="w-full text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 px-2 pr-6 focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                          placeholder="0"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                          %
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {splitType === 'EXACT' && participants.length > 0 && (
                <div
                  className={`mt-3 text-sm p-2 rounded-lg ${exactValid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                >
                  Sum: ${exactSum.toFixed(2)} / ${numAmount.toFixed(2)} {exactValid ? '✓' : '✗'}
                </div>
              )}
              {splitType === 'PERCENTAGE' && participants.length > 0 && (
                <div
                  className={`mt-3 text-sm p-2 rounded-lg ${percentValid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                >
                  Total: {percentSum.toFixed(0)}% / 100% {percentValid ? '✓' : '✗'}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !amount ||
                (splitType === 'EXACT' && !exactValid) ||
                (splitType === 'PERCENTAGE' && !percentValid) ||
                (isMultiplePayers && !payerValid)
              }
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
