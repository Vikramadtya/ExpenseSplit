# ExpenseSplit Deployment Guide

This document outlines the steps to deploy the ExpenseSplit stack:
- **Database**: Neon (Serverless Postgres)
- **Backend**: Render (Node.js/NestJS)
- **Frontend**: Vercel (React/Vite)

> **Security Note:** The backend is configured with strict security practices. No secrets (JWT, Google OAuth, Database URIs) are hardcoded or defaulted to fallbacks in the codebase. If any of the required environment variables are omitted during deployment, the server will immediately throw an error and refuse to boot.

## 1. Database (Neon)
1. Go to [Neon.tech](https://neon.tech/) and create a project.
2. Under your project dashboard, grab the **Postgres Connection String** (it will look like `postgresql://user:password@ep-cool-darkness-1234.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. Save this connection string for the backend deployment.

## 2. Backend (Render)
1. Go to [Render](https://render.com/) and create a new **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build && npm run db:migrate` (applies the reviewed SQL migrations in `backend/drizzle` to Neon; never use `db:push` against production).
   - **Start Command**: `npm run start:prod`
4. **Required Environment Variables (CRITICAL)**:
   - `DATABASE_URL`: Your Neon connection string.
   - `JWT_SECRET`: A strong random string for signing JWT tokens.
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
   - `GOOGLE_CALLBACK_URL`: `https://<YOUR-RENDER-URL>.onrender.com/api/v1/auth/google/callback`
   - `FRONTEND_URL`: `https://<YOUR-VERCEL-URL>.vercel.app` (or whatever domain Vercel issues you).
   - `ENABLE_OPENTELEMETRY`: `false` (Unless you have configured a trace collector).
5. Deploy the service and copy the Render URL.
6. **Important**: Go back to your Google Cloud Console and update your **Authorized Redirect URIs** to include your new Render callback URL.

## 3. Frontend (Vercel)
1. Go to [Vercel](https://vercel.com/) and create a new Project.
2. Connect your GitHub repository.
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://<YOUR-RENDER-URL>.onrender.com/api/v1` (Note: we updated the frontend to dynamically use this environment variable for all API calls if present, overriding the local `/api/v1` proxy logic).
5. Deploy the project.
6. **Important**: Go back to your Google Cloud Console and update your **Authorized JavaScript Origins** to include your new Vercel URL.

## 4. Post-Deployment Checks
- Verify that Google Login successfully redirects back to the Vercel app.
- Check the Render logs to ensure the database schema was pushed successfully (`npm run db:push`).


## Database migrations

Schema changes go through reviewed SQL migrations:

1. Edit `backend/src/database/schema.ts`.
2. `cd backend && npm run db:generate -- --name <what_changed>`, then review the SQL in `backend/drizzle/`.
3. `npm run db:migrate` applies it. CI runs the migrations against a clean Postgres before the integration tests.

### One-time step for databases created with `db:push`

`0000_baseline.sql` recreates the schema as it stood before migrations were adopted. A database that
already has those tables must be told the baseline is applied, otherwise `db:migrate` fails with
"relation already exists". Run once against that database, then use `db:migrate` as normal:

```sql
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
```

and insert the baseline's hash/timestamp (the hash is the SHA-256 of `0000_baseline.sql`; the timestamp is the
`when` of entry 0 in `backend/drizzle/meta/_journal.json`).

`0001_phase0_money_indexes.sql` removes duplicate `expense_splits` / `workspace_members` rows (keeping one per pair) before
adding unique indexes. Take a Neon branch or backup before applying it to production.
