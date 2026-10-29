import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  updateWorkspaceMutation,
  deleteWorkspaceMutation,
  removeMemberMutation,
  getWorkspaceMembersOptions,
} from '../../../api/@tanstack/react-query.gen';
import { X, Settings, Trash2, UserMinus, AlertTriangle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from '@tanstack/react-router';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspace: any;
}

export function WorkspaceSettingsModal({ isOpen, onClose, workspace }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(workspace?.name || '');
  const [currency, setCurrency] = useState(workspace?.defaultCurrency || 'USD');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: members = [] } = useQuery(
    getWorkspaceMembersOptions({ path: { workspaceId: workspace?.id } }),
  );

  const updateMutation = useMutation({
    ...updateWorkspaceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getWorkspace'] });
      queryClient.invalidateQueries({ queryKey: ['getWorkspaces'] });
      toast.success('Workspace updated successfully');
      onClose();
    },
  });

  const deleteMutation = useMutation({
    ...deleteWorkspaceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getWorkspaces'] });
      toast.success('Workspace deleted');
      onClose();
      navigate({ to: '/' });
    },
  });

  const removeMember = useMutation({
    ...removeMemberMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getWorkspaceMembers'] });
      toast.success('Member removed');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || 'Cannot remove member. They might have pending balances.',
      );
    },
  });

  if (!isOpen || !workspace) return null;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      path: { workspaceId: workspace.id },
      body: { name, defaultCurrency: currency },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-main">Workspace Settings</h2>
              <p className="text-sm text-text-muted">Manage preferences and members</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-10">
          {/* General Settings */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              General
            </h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={
                    updateMutation.isPending ||
                    (name === workspace.name && currency === workspace.defaultCurrency)
                  }
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>

          {/* Members */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
              Members
            </h3>
            <div className="border border-border rounded-2xl overflow-hidden bg-background">
              {members.map((member: any, idx: number) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-4 ${
                    idx !== members.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-main">
                        {member.name}{' '}
                        {member.role === 'ADMIN' && (
                          <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-text-muted">{member.email}</p>
                    </div>
                  </div>
                  {member.role !== 'ADMIN' && (
                    <button
                      onClick={() =>
                        removeMember.mutate({
                          path: { workspaceId: workspace.id, userId: member.id },
                        })
                      }
                      disabled={removeMember.isPending}
                      className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Remove Member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-2">
            <div className="p-5 border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 rounded-2xl">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </h3>
              <p className="text-sm text-text-muted mb-4">
                Deleting this workspace will permanently remove all expenses, settlements, and
                member data. This action cannot be undone.
              </p>

              {showDeleteConfirm ? (
                <div className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-300">
                  <button
                    onClick={() => deleteMutation.mutate({ path: { workspaceId: workspace.id } })}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                  >
                    Yes, delete permanently
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-text-main bg-background border border-border hover:bg-border/50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Workspace
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
