# ExpenseSplit

ExpenseSplit is a modern, modular SaaS platform for tracking shared expenses, built with a strictly-typed Clean Architecture. 

## Features
- **Groups and friends:** shared groups with roles, invite links, and a private ledger for each pair of friends.
- **Exact money:** amounts are exact integers of each currency's smallest unit (cents, yen, fils), with ISO 4217 decimals for any currency; splits (equal, exact, percentage, shares, itemized) always add up exactly.
- **Receipts:** photograph a receipt, tap who had what, and tax and tip are shared in proportion.
- **Multi-currency:** each expense keeps its own currency; balances are per currency with an optional converted total.
- **Settling up:** simplified or pairwise debts, partial payments, and UPI / PayPal / Venmo pay links.
- **Always current:** live updates between members, optimistic edits with Undo, installable offline-capable PWA.
- **Recurring bills, budgets and reminders:** with in-app, push and email notifications.
- **Analytics, CSV export, Splitwise import:** per-currency spend, categories, tags, month-over-month.
- **Your data:** download everything, or delete your account.

## Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4, TanStack Router, TanStack Query.
- **Backend:** NestJS (Express), PostgreSQL + Drizzle, Zod validation, OpenAPI-driven design.
- **API Contract:** Generated via `@hey-api/openapi-ts`.

## Getting Started

Follow these steps to run the application locally.

### Prerequisites
- Node.js (v20+ recommended)
- npm

### 1. Install Dependencies

First, install dependencies for both the frontend and backend.

```bash
# In the root directory (if using workspaces, otherwise run in both folders)
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and configure it with your credentials (e.g., Google OAuth).

```bash
# From the root directory
cp .env.example .env
```

### 3. Generate API Client
The frontend relies on the `openapi-ts` SDK generated from the root `openapi.yaml`. If you make changes to the OpenAPI spec, you need to regenerate the client.

```bash
cd frontend
npm run generate:api
```

### 3. Start the Backend Server
Start the NestJS backend in development mode.

```bash
cd backend
npm run db:migrate   # apply database migrations
npm run start:dev
```
The backend will run on `http://localhost:3000`.

### 4. Start the Frontend App
In a new terminal window, start the Vite development server.

```bash
cd frontend
npm run dev
```
The frontend will be available at `http://localhost:5173`.

## Architecture Note
The backend implements **Dependency Inversion** with Custom Providers mapping to Abstract Interfaces (e.g., `IWorkspacesRepository`). The frontend uses **Feature-Sliced Design (FSD)** located in `src/features/[domain]`.

## Testing

```bash
cd backend
npm test                                              # unit tests
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/expensesplit_test npm run db:migrate
TEST_DATABASE_URL=... npm run test:e2e                # integration tests against a real Postgres
```

Load testing: `scripts/seed-bench.sql` seeds a 10,000-expense group into a throwaway database and
`scripts/bench.mjs` measures latency percentiles (see the file headers).

See [docs/implementation-plan.md](docs/implementation-plan.md) for status, [docs/security.md](docs/security.md)
for the security model, and `.env.example` for every setting.
