# ExpenseSplit Deployment Guide

This document outlines the steps to deploy the ExpenseSplit stack:
- **Database**: Neon (Serverless Postgres)
- **Backend**: Render (Node.js/NestJS)
- **Frontend**: Vercel (React/Vite)

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
   - **Build Command**: `npm install && npm run build && npm run db:push` (This ensures Drizzle pushes your schema to Neon during deployment).
   - **Start Command**: `npm run start:prod`
4. **Environment Variables**:
   - `DATABASE_URL`: Your Neon connection string.
   - `JWT_SECRET`: A strong random string for signing JWT tokens.
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
   - `GOOGLE_CALLBACK_URL`: `https://<YOUR-RENDER-URL>.onrender.com/api/v1/auth/google/callback`
   - `FRONTEND_URL`: `https://<YOUR-VERCEL-URL>.vercel.app`
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
   - `VITE_API_BASE_URL`: `https://<YOUR-RENDER-URL>.onrender.com`
5. Deploy the project.
6. **Important**: Go back to your Google Cloud Console and update your **Authorized JavaScript Origins** to include your new Vercel URL.

## 4. Post-Deployment Checks
- Verify that Google Login successfully redirects back to the Vercel app.
- Check the Render logs to ensure the database schema was pushed successfully (`npm run db:push`).
