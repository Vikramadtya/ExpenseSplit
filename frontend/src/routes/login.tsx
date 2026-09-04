import { Link } from '@tanstack/react-router';
import { ArrowRight, PieChart, Users, Zap, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '../features/theme/components/ThemeToggle';

export default function LoginRoute() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden bg-background">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Left Side - Features */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center z-10 hidden lg:flex border-r border-white/10 bg-surface/30 backdrop-blur-sm">
        <div className="max-w-xl mx-auto w-full">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-primary/20 ring-1 ring-white/10">
            <img src="/logo.svg" alt="ExpenseSplit Logo" className="w-10 h-10 drop-shadow-md" />
          </div>

          <h1 className="font-display text-5xl font-bold mb-6 leading-tight">
            The smartest way to <br />{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
              split expenses.
            </span>
          </h1>

          <p className="text-xl text-text-muted mb-12">
            Never argue about who owes what again. ExpenseSplit calculates exactly how to settle
            debts with the fewest possible transactions.
          </p>

          <div className="space-y-8">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0 shadow-sm group hover:border-primary transition-colors">
                <PieChart className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Real-time Balances</h3>
                <p className="text-text-muted">
                  Instantly see who is up and who is down across all your shared workspaces and
                  trips.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0 shadow-sm group hover:border-primary transition-colors">
                <Zap className="w-6 h-6 text-yellow-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Debt Simplification</h3>
                <p className="text-text-muted">
                  Our advanced graph algorithm minimizes total transactions so everyone settles up
                  faster.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0 shadow-sm group hover:border-primary transition-colors">
                <Users className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Shared Workspaces</h3>
                <p className="text-text-muted">
                  Create isolated groups for roommates, road trips, or regular dinner clubs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Panel */}
      <div className="flex-1 flex items-center justify-center p-6 z-10 w-full min-h-screen lg:min-h-0 relative">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="lg:hidden flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20 ring-1 ring-white/10">
              <img src="/logo.svg" alt="ExpenseSplit Logo" className="w-10 h-10 drop-shadow-md" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-2">Welcome to ExpenseSplit</h1>
            <p className="text-text-muted">Sign in to manage your shared expenses seamlessly.</p>
          </div>

          <div className="glass-panel p-8 sm:p-12 w-full flex flex-col items-center text-center relative overflow-hidden group hover:border-primary/30 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <h2 className="font-display text-2xl font-bold mb-2 z-10">Get Started</h2>
            <p className="text-text-muted mb-8 z-10">Connect your account to continue</p>

            {import.meta.env.VITE_BYPASS_AUTH === 'true' ? (
              <Link
                to="/workspaces"
                className="w-full bg-white text-gray-900 hover:bg-gray-50 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md border border-gray-200 flex items-center justify-center gap-3 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out" />
                <span className="relative z-10 font-bold">Enter Application (Dev Mode)</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform relative z-10" />
              </Link>
            ) : (
              <a
                href={`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/google`}
                className="w-full bg-white text-gray-900 hover:bg-gray-50 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md border border-gray-200 flex items-center justify-center gap-3 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out" />
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="relative z-10">Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform relative z-10" />
              </a>
            )}

            <div className="w-full flex items-center justify-between mt-8 text-sm text-text-muted z-10">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Secure login
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Free forever
              </span>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-8 text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
