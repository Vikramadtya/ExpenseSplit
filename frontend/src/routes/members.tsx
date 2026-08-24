import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../layouts/DashboardLayout';
import { getWorkspaceMembersOptions } from '../api/@tanstack/react-query.gen';
import { Users, UserPlus, Mail } from 'lucide-react';
import { InviteMemberModal } from '../features/workspaces/components/InviteMemberModal';

export default function MembersPage({ workspaceId }: { workspaceId: string }) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { data: members = [], isLoading } = useQuery(
    getWorkspaceMembersOptions({ path: { workspaceId } }),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-text-main flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Workspace Members
            </h1>
            <p className="text-text-muted text-sm mt-1">Manage the people in your workspace</p>
          </div>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </header>

        <div className="glass-panel overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No members found in this workspace.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member: any) => (
                <div
                  key={member.id}
                  className="p-5 flex items-center justify-between hover:bg-surface/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary font-display border border-primary/20">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-text-main text-base">{member.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface border border-border text-text-muted">
                      Member
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isInviteOpen && (
        <InviteMemberModal
          workspaceId={workspaceId}
          isOpen={true}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}
