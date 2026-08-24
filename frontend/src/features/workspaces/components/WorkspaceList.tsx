import { Link } from '@tanstack/react-router';
import { Users, ChevronRight, Plus } from 'lucide-react';

interface WorkspaceListProps {
  workspaces: any[];
  isLoading: boolean;
  setShowCreate: (show: boolean) => void;
}

export function WorkspaceList({ workspaces, isLoading, setShowCreate }: WorkspaceListProps) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold font-display text-text-main mb-6">Your Workspaces</h2>
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-xl border border-border"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace: any) => (
            <Link
              key={workspace.id}
              to="/dashboard"
              search={{ workspaceId: workspace.id }}
              className="glass-panel p-6 group hover:-translate-y-1 transition-all duration-300 cursor-pointer hover:border-primary/50 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start relative z-10">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
                </div>
              </div>
              <h3 className="font-display font-semibold text-lg mb-1 relative z-10">
                {workspace.name}
              </h3>
              <p className="text-xs text-text-muted relative z-10">
                Created {new Date(workspace.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}

          <button
            onClick={() => setShowCreate(true)}
            className="glass-panel p-6 flex flex-col items-center justify-center border-dashed border-2 border-border hover:border-primary/50 hover:bg-surface/80 transition-all duration-300 text-text-muted hover:text-text-main group min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <span className="font-medium text-sm">Create Workspace</span>
          </button>
        </div>
      )}
    </div>
  );
}
