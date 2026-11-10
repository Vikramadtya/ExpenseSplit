import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { createInviteMutation } from '../../../api/@tanstack/react-query.gen';

/** Creates a shareable join link. The server shows the raw token only once. */
export function InviteLinkSection({ workspaceId }: { workspaceId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    ...createInviteMutation(),
    onSuccess: (data) => setLink(`${window.location.origin}/join/${data.token}`),
    onError: () => toast.error('Only admins can create invite links'),
  });

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-bold text-gray-900  mb-1 flex items-center gap-2">
        <Link2 className="w-4 h-4" />
        Invite with a link
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Anyone with the link can join. It expires in 7 days.
      </p>
      {link ? (
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="field flex-1 min-w-0"
          />
          <button
            onClick={copy}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => create.mutate({ path: { workspaceId } })}
          disabled={create.isPending}
          className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 rounded-xl transition-colors"
        >
          {create.isPending ? 'Creating…' : 'Create invite link'}
        </button>
      )}
    </div>
  );
}
