# ExpenseSplit

ExpenseSplit is a modern, modular SaaS platform for tracking shared expenses, built with a strictly-typed Clean Architecture. 

## Features
- **Real-time Balances:** Instantly see who is up and who is down across shared workspaces.
- **Smart Debt Simplification:** Graph algorithm minimizes the total number of transactions needed to settle up.
- **Shared Workspaces:** Isolate groups for roommates, trips, and clubs.
- **Enterprise Architecture:** Built using Feature-Sliced Design (Frontend) and Strict Interfaces with Dependency Inversion (Backend).

## Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4, TanStack Router, TanStack Query.
- **Backend:** NestJS, Fastify, Zod Validation, OpenAPI-driven design.
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
