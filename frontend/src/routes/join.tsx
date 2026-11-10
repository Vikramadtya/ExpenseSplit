import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { acceptInviteMutation, previewInviteOptions } from '../api/@tanstack/react-query.gen';

export default function JoinRoute({ token }: { token: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: invite,
    isLoading,
    isError,
  } = useQuery({ ...previewInviteOptions({ path: { token } }), retry: false });

  const accept = useMutation({
    ...acceptInviteMutation(),
    onSuccess: async ({ workspaceId }) => {
      await queryClient.invalidateQueries({ queryKey: ['getWorkspaces'] });
      navigate({ to: '/dashboard', search: { workspaceId } });
    },
    onError: () => toast.error('Could not join. The link may have expired.'),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Users className="w-7 h-7" />
        </div>
        {isLoading ? (
          <p className="text-text-muted">Checking invite…</p>
        ) : isError || !invite ? (
          <>
            <h1 className="text-xl font-bold text-text-main">Invite not valid</h1>
            <p className="mt-2 text-sm text-text-muted">
              This link has expired or was revoked. Ask for a new one.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {invite.invitedBy
                ? `${invite.invitedBy} invited you to join`
                : 'You are invited to join'}
            </p>
            <h1 className="text-2xl font-bold text-text-main mt-1">{invite.workspaceName}</h1>
            <p className="text-sm text-text-muted mt-1">
              {invite.memberCount} {invite.memberCount === 1 ? 'member' : 'members'}
            </p>
            <button
              onClick={() => accept.mutate({ path: { token } })}
              disabled={accept.isPending}
              className="btn-primary mt-6 w-full"
            >
              {invite.alreadyMember
                ? 'Open workspace'
                : accept.isPending
                  ? 'Joining…'
                  : 'Join workspace'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
