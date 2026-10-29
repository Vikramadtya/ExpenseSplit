import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createExpenseCommentMutation,
  deleteCommentMutation,
  listExpenseCommentsOptions,
  listExpenseCommentsQueryKey,
} from '../../../api/@tanstack/react-query.gen';

export function ExpenseComments({ expenseId }: { expenseId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const options = listExpenseCommentsOptions({ path: { expenseId } });
  const { data: comments = [] } = useQuery(options);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: listExpenseCommentsQueryKey({ path: { expenseId } }),
    });

  const add = useMutation({
    ...createExpenseCommentMutation(),
    onSuccess: () => {
      setBody('');
      refresh();
    },
    onError: () => toast.error('Could not post the comment'),
  });
  const remove = useMutation({
    ...deleteCommentMutation(),
    onSuccess: refresh,
    onError: () => toast.error('You can only delete your own comments'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim()) add.mutate({ path: { expenseId }, body: { body: body.trim() } });
  };

  return (
    <div className="px-6 pb-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4" />
        Comments ({comments.length})
      </h3>
      <ul className="space-y-3 mb-3">
        {comments.map((c) => (
          <li key={c.id} className="group flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.user?.name}</span>{' '}
              <span className="text-zinc-600 dark:text-zinc-300 break-words">{c.body}</span>
              <div className="text-xs text-zinc-400">{new Date(c.createdAt).toLocaleString()}</div>
            </div>
            <button
              type="button"
              onClick={() => remove.mutate({ path: { commentId: c.id } })}
              className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete comment"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Add a comment…"
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-white"
        />
        <button
          type="submit"
          disabled={!body.trim() || add.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl"
        >
          Post
        </button>
      </form>
    </div>
  );
}
