import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LoginRoute from './routes/login';
import WorkspacesRoute from './routes/workspaces';
import DashboardRoute from './routes/dashboard';
import AnalyticsRoute from './routes/analytics';
import MembersRoute from './routes/members';
import ExpensesRoute from './routes/expenses';
import FriendsRoute from './routes/friends';
import { client } from './api/client.gen';
import { logger } from './utils/logger';

client.interceptors.request.use((request) => {
  logger.debug('API_REQUEST', `${request.method} ${request.url}`);
  const token = localStorage.getItem('access_token');
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

client.interceptors.response.use((response) => {
  logger.info('API_RESPONSE', `${response.status} ${response.url}`);
  return response;
});

const queryClient = new QueryClient();

// ─── Route Tree ───────────────────────────────────────────────────────────────

const requireAuth = () => {
  if (import.meta.env.VITE_BYPASS_AUTH === 'true') return;
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw redirect({ to: '/login' });
  }
};

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-text-main font-sans">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/login' });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginRoute,
});

type AuthCallbackSearch = { token?: string };

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  validateSearch: (search: Record<string, unknown>): AuthCallbackSearch => ({
    token: (search.token as string) || undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.token) {
      localStorage.setItem('access_token', search.token);
      throw redirect({ to: '/workspaces' });
    } else {
      throw redirect({ to: '/login' });
    }
  },
});

const workspacesRoute = createRoute({
  getParentRoute: () => rootRoute,
  beforeLoad: requireAuth,
  path: '/workspaces',
  component: WorkspacesRoute,
});

type WorkspaceSearch = { workspaceId: string };

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  beforeLoad: requireAuth,
  path: '/dashboard',
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    workspaceId: (search.workspaceId as string) ?? '',
  }),
  component: function DashboardPage() {
    const { workspaceId } = dashboardRoute.useSearch();
    if (!workspaceId) throw redirect({ to: '/workspaces' });
    return <DashboardRoute workspaceId={workspaceId} />;
  },
});

const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  beforeLoad: requireAuth,
  path: '/members',
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    workspaceId: (search.workspaceId as string) ?? '',
  }),
  component: function MembersPage() {
    const { workspaceId } = membersRoute.useSearch();
    if (!workspaceId) throw redirect({ to: '/workspaces' });
    return <MembersRoute workspaceId={workspaceId} />;
  },
});

const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  beforeLoad: requireAuth,
  path: '/expenses',
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    workspaceId: (search.workspaceId as string) ?? '',
  }),
  component: function ExpensesPage() {
    const { workspaceId } = expensesRoute.useSearch();
    if (!workspaceId) throw redirect({ to: '/workspaces' });
    return <ExpensesRoute workspaceId={workspaceId} />;
  },
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  beforeLoad: requireAuth,
  path: '/analytics',
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    workspaceId: (search.workspaceId as string) ?? '',
  }),
  component: function AnalyticsPage() {
    const { workspaceId } = analyticsRoute.useSearch();
    if (!workspaceId) throw redirect({ to: '/workspaces' });
    return <AnalyticsRoute workspaceId={workspaceId} />;
  },
});

const friendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  beforeLoad: requireAuth,
  path: '/friends',
  component: FriendsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authCallbackRoute,
  workspacesRoute,
  dashboardRoute,
  expensesRoute,
  membersRoute,
  analyticsRoute,
  friendsRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const err = error as Error;
  return (
    <div role="alert" className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="glass-panel p-8 max-w-lg w-full">
        <h2 className="font-display text-xl font-bold text-red-500 mb-3">Something went wrong</h2>
        <pre className="text-sm text-text-muted bg-surface p-4 rounded-lg overflow-auto mb-6 whitespace-pre-wrap">
          {err.message}
        </pre>
        <button onClick={resetErrorBoundary} className="btn-primary text-sm">
          Try Again
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
