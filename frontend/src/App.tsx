import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from './offline/persist';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';

const LoginRoute = lazy(() => import('./routes/login'));
const WorkspacesRoute = lazy(() => import('./routes/workspaces'));
const DashboardRoute = lazy(() => import('./routes/dashboard'));
const AnalyticsRoute = lazy(() => import('./routes/analytics'));
const MembersRoute = lazy(() => import('./routes/members'));
const ExpensesRoute = lazy(() => import('./routes/expenses'));
const FriendsRoute = lazy(() => import('./routes/friends'));
const JoinRoute = lazy(() => import('./routes/join'));
import { client } from './api/client.gen';
import { PageSkeleton } from './components/ui/PageSkeleton';
import { getAccessToken, getFreshAccessToken, saveSession } from './auth/session';

if (import.meta.env.VITE_API_BASE_URL) {
  client.setConfig({ baseUrl: import.meta.env.VITE_API_BASE_URL });
}
import { logger } from './utils/logger';

client.interceptors.request.use(async (request) => {
  logger.debug('API_REQUEST', `${request.method} ${request.url}`);
  const token = await getFreshAccessToken();
  if (token) request.headers.set('Authorization', `Bearer ${token}`);
  return request;
});

client.interceptors.response.use((response) => {
  logger.info('API_RESPONSE', `${response.status} ${response.url}`);
  // The session is gone (revoked or expired): send the user back to sign in.
  if (response.status === 401 && !getAccessToken() && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
  return response;
});

// ─── Route Tree ───────────────────────────────────────────────────────────────

const POST_LOGIN_KEY = 'post_login_redirect';

const requireAuth = () => {
  if (import.meta.env.VITE_BYPASS_AUTH === 'true') return;
  if (!getAccessToken()) {
    throw redirect({ to: '/login' });
  }
};

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-text-main font-sans">
      <Suspense
        fallback={
          <div className="p-8">
            <PageSkeleton />
          </div>
        }
      >
        <Outlet />
      </Suspense>
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

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  beforeLoad: ({ location }) => {
    // The API returns the token in the URL fragment so it never reaches servers or logs.
    const params = new URLSearchParams(location.hash);
    const token = params.get('token');
    if (!token) throw redirect({ to: '/login' });
    saveSession(token, params.get('refresh'));
    // Return to where sign-in was interrupted (e.g. an invite link), if anywhere.
    const next = sessionStorage.getItem(POST_LOGIN_KEY);
    sessionStorage.removeItem(POST_LOGIN_KEY);
    if (next?.startsWith('/join/')) throw redirect({ href: next, replace: true });
    throw redirect({ to: '/workspaces', replace: true });
  },
});

const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/join/$token',
  beforeLoad: ({ location }) => {
    if (!getAccessToken()) {
      sessionStorage.setItem(POST_LOGIN_KEY, location.pathname);
      throw redirect({ to: '/login' });
    }
  },
  component: function JoinPage() {
    const { token } = joinRoute.useParams();
    return <JoinRoute token={token} />;
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
  joinRoute,
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

// ─── Backend Health Check ─────────────────────────────────────────────────────

function BackendHealthCheck() {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    let toastId: string | undefined;
    let isConnected = false;

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const url = baseUrl.endsWith('/') ? baseUrl + 'health' : baseUrl + '/health';

    // Trigger loading toast if not connected after 1 second
    const delayToastTimer = setTimeout(() => {
      if (!isConnected) {
        toastId = toast.loading('Waiting for backend server to start. Give it a min...', {
          duration: Infinity,
        });
      }
    }, 1000);

    const checkHealth = async () => {
      if (isConnected) return;
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(fetchTimeout);

        if (response.ok) {
          isConnected = true;
          clearTimeout(delayToastTimer);
          if (toastId) {
            toast.success('Backend server is ready!', { id: toastId, duration: 4000 });
          }
          return;
        }
      } catch (_e) {
        // Ignore fetch errors during cold start
      }

      timeoutId = setTimeout(() => checkHealth(), 3000);
    };

    checkHealth();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(delayToastTimer);
      if (toastId && !isConnected) {
        toast.dismiss(toastId);
      }
    };
  }, []);

  return null;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: 'v1' }}
    >
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <BackendHealthCheck />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#334155',
              color: '#fff',
              borderRadius: '9999px',
              fontWeight: 500,
              padding: '12px 24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
          }}
        />
        <RouterProvider router={router} />
      </ErrorBoundary>
    </PersistQueryClientProvider>
  );
}

export default App;
