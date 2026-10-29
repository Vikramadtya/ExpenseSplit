# Security notes

How the app protects people's data, and the risks that are knowingly accepted.

## How it is protected

- **Tenant isolation.** Every route is authenticated unless marked `@Public()`. Any route with a
  `:workspaceId` is checked against membership by a global guard; non-members get the same 404 as
  for a workspace that doesn't exist. Admin-only routes use `@Roles('ADMIN')`. The integration suite
  tries every workspace route as an outsider.
- **Sessions.** 15-minute access tokens plus single-use, rotating refresh tokens (stored hashed).
  Replaying an old refresh token revokes the whole sign-in chain. Tokens live in `localStorage`
  (no cookies), so XSS would expose them; helmet headers reduce that risk, and rotation limits what a
  stolen refresh token is worth. Moving to httpOnly cookies needs the API served same-site as the
  web app.
- **Input.** Every body is validated by a global Zod pipe; people named in an expense must be
  workspace members; money is exact integer cents. Receipt uploads are identified by their bytes,
  not their `Content-Type`, and served with `nosniff`. CSV export neutralises spreadsheet formulas.
- **Abuse limits.** Global rate limit, and far lower limits on sign-in, receipt uploads (each scan
  costs money), imports and account deletion.
- **Privacy.** Account deletion erases personal data and keeps the shared ledger intact under an
  anonymous "Deleted user". `GET /users/me/export` downloads a copy of your data.
- **Secrets.** Nothing is defaulted in code; the server refuses to start without its secrets. CI
  scans the git history for committed secrets.

## Known limits and accepted risks

| Item | Why it is accepted |
|------|--------------------|
| `/metrics` is unauthenticated | Prometheus scrapers send no JWT. Restrict it at the network edge (private network or proxy rule). It exposes route templates and timings, no user data. |
| Access tokens stay valid up to 15 min after account deletion | They hold no data and the deleted user has no memberships; shortening further costs more refreshes. |
| `multer` (high) via `@nestjs/platform-express` | Only reachable through multipart upload interceptors, which this app never uses (uploads are raw bodies). |
| `deepmerge` (low) via `nestjs-zod` | The suggested fix is a major downgrade of `nestjs-zod`. |
| `vite-plugin-pwa` / `workbox-build` (low) | Build-time tooling only; the suggested fix is a major downgrade. |
| Live sync and the pairwise-debts cache are per process / per DB | Live events reach only clients connected to the same instance until the in-memory event bus is replaced by Redis pub/sub. The debts cache validates itself against the database, so it is safe with several instances. |
| Receipt photos are stored on local disk | Fine for one instance; use the `ReceiptStorage` adapter for S3/R2 before running several. |

## Reporting a problem

Open a private security advisory on the repository rather than a public issue.
