# Persistence Architecture

This document outlines the database schema and data relationships for ExpenseSplit. The database is a PostgreSQL instance (hosted on Neon) and is managed via **Drizzle ORM**.

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ workspace_members : "belongs to"
    users ||--o{ expenses : "creates"
    users ||--o{ expense_splits : "pays/owes"
    
    workspaces ||--o{ workspace_members : "has"
    workspaces ||--o{ expenses : "contains"
    workspaces ||--o{ settlements : "contains"

    expenses ||--o{ expense_splits : "has"

    users {
        uuid id PK
        varchar email
        varchar name
        text avatar_url
    }

    workspaces {
        uuid id PK
        varchar name
    }

    workspace_members {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        enum role
    }

    expenses {
        uuid id PK
        uuid workspace_id FK
        varchar description
        decimal amount
        enum split_type
        enum type
        text[] tags
        enum recurring_interval
    }

    expense_splits {
        uuid id PK
        uuid expense_id FK
        uuid user_id FK
        decimal amount_owed
        decimal amount_paid
    }

    settlements {
        uuid id PK
        uuid workspace_id FK
        uuid payer_id FK
        uuid payee_id FK
        decimal amount
    }
```

## Table Structures

### 1. Core Entites
- **`users`**: Represents individuals logged in via Google OAuth. 
- **`workspaces`**: The highest-level container. Workspaces act as isolated tenants. All debts and expenses are scoped to a single workspace.

### 2. Groupings & Membership
- **`workspace_members`**: Junction table mapping users to workspaces, storing authorization roles (`ADMIN`, `MEMBER`). Row-Level Security (RLS) is applied based on this table.
- *(Note: A Workspace is conceptually equivalent to a "Group" in typical expense splitting apps like Splitwise. The previously redundant `groups` tables have been removed to flatten the hierarchy and simplify UX.)*

### 3. Financial Ledgers
- **`expenses`**: The core transaction record. Note that an expense does **not** have a `paid_by` column. Instead, it relies entirely on the splits table to support multi-payer logic. It also supports cash transfers via the `type` column (`EXPENSE` vs `TRANSFER`).
- **`expense_splits`**: Links an expense to a user. Crucially, it stores both:
  - `amount_paid`: How much the user put out of pocket for the expense.
  - `amount_owed`: How much of the total cost is mathematically assigned to this user.
  - *Note*: Net balance for a single expense = `amount_paid - amount_owed`.
- **`settlements`**: Direct cash transfers resolving debts between two users (`payer_id` and `payee_id`).

## Multi-Payer Split Architecture
When an expense of $100 is paid by Alice ($60) and Bob ($40), and split evenly among Alice, Bob, and Charlie:
1. `expenses` is inserted ($100).
2. `expense_splits` for Alice: `amount_paid: 60`, `amount_owed: 33.34`. (Alice is +26.66)
3. `expense_splits` for Bob: `amount_paid: 40`, `amount_owed: 33.33`. (Bob is +6.67)
4. `expense_splits` for Charlie: `amount_paid: 0`, `amount_owed: 33.33`. (Charlie is -33.33)

## Local Database Inspection (Docker)

If you are running the backend locally via Docker (`docker-compose up`), you can easily inspect the data inside the local PostgreSQL container.

### Option 1: Using the Terminal (psql)
You can drop directly into the PostgreSQL interactive terminal inside the running container by executing this command:

```bash
docker exec -it expensesplit-postgres psql -U postgres -d expensesplit
```

Once inside the `psql` shell, you can run standard SQL commands:
- `\dt` - List all tables
- `\d users` - View the schema for the `users` table
- `SELECT * FROM workspaces;` - Query data (don't forget the semicolon!)
- `\q` - Quit the terminal

### Option 2: Using Drizzle Studio
Since we use Drizzle ORM, you can spin up Drizzle's visual database studio. Open a new terminal in the `backend` folder and run:
```bash
npm run db:studio
```
This will open a visual table editor in your browser on `https://local.drizzle.studio`.

### Option 3: Using a GUI Client (e.g., TablePlus, DBeaver, DataGrip)
You can connect your favorite database GUI to the container using these credentials from your `docker-compose.yml`:
- **Host**: `localhost`
- **Port**: `5433` *(Note: It is mapped to 5433 on your host machine to avoid conflicts)*
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `expensesplit`
