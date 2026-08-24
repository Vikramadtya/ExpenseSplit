# Authentication & Authorization in ExpenseSplit

This document explains how ExpenseSplit securely identifies users (Authentication) and ensures they only access data they are allowed to see (Authorization). The backend employs a defense-in-depth strategy using NestJS Guards and PostgreSQL Row-Level Security (RLS).

## 1. Authentication (Identity)

Authentication verifies *who* the user is. ExpenseSplit uses **Google OAuth 2.0** combined with **JWT (JSON Web Tokens)**.

### The Flow
1. User clicks "Sign in with Google" -> Triggers `GET /api/v1/auth/google` (protected by Passport's Google Strategy).
2. Google redirects back to `GET /api/v1/auth/google/callback` with a profile.
3. `AuthService.validateOAuthLogin` checks the `users` table for the email. If not found, it provisions a new user UUID.
4. A JWT is signed containing the user's UUID (`sub` claim) and returned to the frontend.
5. The frontend attaches this JWT as a Bearer token in the `Authorization` header for all subsequent API requests (handled via an Axios interceptor in `App.tsx`).

### Protecting Endpoints (`JwtAuthGuard`)
To require a user to be logged in to access an endpoint, we use the `JwtAuthGuard`. 
- **Where is it used?** It is applied primarily at the **Controller Level**.
- **Example**:
  ```typescript
  @UseGuards(JwtAuthGuard)
  @Controller('api/v1/users')
  export class UsersController { ... }
  ```
- **What it does**: It intercepts the request, extracts the Bearer token, validates the cryptographic signature, and attaches the decoded user object to `req.user`.

---

## 2. Authorization (Access Control)

Authorization verifies *what* the authenticated user is allowed to do. ExpenseSplit is a multi-tenant app where data is isolated by **Workspaces**.

### Application Level: `WorkspaceMemberGuard`
Even if a user is logged in, they cannot access workspace data unless they are an explicit member of that workspace.

- **Where is it used?** Applied to specific methods or controllers that handle workspace-specific data (e.g., creating expenses, viewing balances).
- **How it works**:
  1. The user must first pass the `JwtAuthGuard` (so `req.user` exists).
  2. The `WorkspaceMemberGuard` looks for `workspaceId` in the request parameters, body, or query string.
  3. It queries the `workspace_members` table to verify that `req.user.id` has a row matching the requested `workspaceId`.
  4. If they don't, it throws a `403 Forbidden` exception.
- **Example**:
  ```typescript
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  @Get('workspaces/:workspaceId/expenses')
  getExpenses(@Param('workspaceId') workspaceId: string) { ... }
  ```

### Database Level: PostgreSQL Row-Level Security (RLS)
To prevent accidental data leaks (e.g., a developer forgets to add the `WorkspaceMemberGuard`, or writes a bad SQL query), we enforce authorization directly inside the database engine.

- **Where is it used?** Configured via raw SQL migrations (`backend/src/database/rls.sql`).
- **How it works**:
  1. In PostgreSQL, tables like `expenses`, `expense_splits`, and `settlements` have RLS policies enabled.
  2. The policy dictates that a row can only be `SELECT`ed, `INSERT`ed, or `UPDATE`d if the row's `workspace_id` matches the current execution context.
  3. When NestJS makes a database query, it first injects the context: `SET LOCAL app.current_workspace_id = 'ws-123'`.
  4. The database mathematically blocks any query attempting to read or write data outside of `ws-123`.

## Summary
1. **Google OAuth** confirms the user's email.
2. **JWT** keeps them logged in.
3. **`JwtAuthGuard`** prevents anonymous API access.
4. **`WorkspaceMemberGuard`** prevents users from peeking into workspaces they don't belong to.
5. **Postgres RLS** provides an unbreakable database-level safety net guaranteeing tenant isolation.
