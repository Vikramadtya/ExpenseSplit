# Backend Development Guide

This document is a crash course on the core concepts used across the **Controllers**, **Guards**, and **Drizzle ORM** in ExpenseSplit. Understanding these three layers (API -> Logic -> Database) will equip you to build any new feature independently.

---

## Layer 1: The Controller (Handling API Requests)
The controller's only job is to receive the HTTP request, validate the data, and pass it to the Service. It should *never* contain business logic.

* **Routing Decorators**: 
  * `@Controller('api/v1')` groups all endpoints in the file under a base URL.
  * `@Get('workspaces/:id')` / `@Post(...)` / `@Delete(...)` define the HTTP method and path.
* **Parameter Extractors**:
  * `@Param('id') id: string` grabs the `:id` from the URL.
  * `@Body() body: CreateExpenseDto` grabs the JSON payload from the request.
  * `@Req() request: RequestWithUser` grabs the underlying Express request (which securely holds our logged-in user).
* **Validation (Zod DTOs)**: By defining a `CreateExpenseDto` using `nestjs-zod`, NestJS automatically intercepts the request. If the client sends a bad payload (e.g., amount is a string instead of a number), NestJS rejects it with a `400 Bad Request` *before* it even hits your code!
* **Custom Status Codes**: By default, NestJS returns `200 OK` for POST requests. We use `@HttpCode(201)` to explicitly return `201 Created` when creating new resources.

---

## Layer 2: Security & Guards (Protecting Endpoints)
We use a defense-in-depth strategy using NestJS Guards. A Guard runs *before* the controller and can block the request.

* **`@UseGuards(JwtAuthGuard)`**: This checks the `Authorization: Bearer <token>` header. If the token is valid, it decodes it and attaches the user to `request.user`. If it's invalid/missing, it throws a `401 Unauthorized`. Apply this at the top of a Controller to protect all its endpoints.
* **`@UseGuards(WorkspaceMemberGuard)`**: Custom to ExpenseSplit. It intercepts requests like `/workspaces/:workspaceId/...`, checks if `request.user.id` is actually a member of that `workspaceId` in the database, and throws a `403 Forbidden` if a user attempts to access an unauthorized workspace.

---

## Layer 3: Drizzle ORM (Talking to the Database)
This happens in the `*.repository.ts` files. Drizzle provides two ways to query data: the **Relational API** (great for reads) and the **SQL-like API** (great for writes).

### 1. Reading Data (Relational API)
Drizzle makes reading data and joining tables incredibly easy using `this.db.query`.

```typescript
import { eq, and } from 'drizzle-orm';
import { expenses } from '../database/schema';

// Find a single record
const expense = await this.db.query.expenses.findFirst({
  where: eq(expenses.id, expenseId),
});

// Find many records with filters
const workspaceExpenses = await this.db.query.expenses.findMany({
  where: eq(expenses.workspaceId, workspaceId),
});

// Joins (Fetching an expense AND the user who created it)
// This requires relations (like `expensesRelations`) to be defined in schema.ts
const expensesWithUsers = await this.db.query.expenses.findMany({
  with: {
    createdBy: true, // Fetches the full user object
    splits: true,    // Fetches the array of expense splits
  }
});
```

### 2. Writing Data (SQL-like API)
For Inserts, Updates, and Deletes, Drizzle mimics standard SQL.

**Insert:**
*Crucial concept: Always remember to `await` and use `.returning()` if you want the data back!*
```typescript
const [newExpense] = await this.db
  .insert(expenses)
  .values({ 
    description: 'Dinner', 
    amount: 50.00,
    workspaceId: 'ws-123' 
  })
  .returning(); // Tells Postgres to return the generated ID and timestamps
```

**Update:**
```typescript
const [updatedExpense] = await this.db
  .update(expenses)
  .set({ description: 'Lunch' })
  .where(eq(expenses.id, expenseId))
  .returning();
```

**Delete:**
```typescript
await this.db
  .delete(expenses)
  .where(and(
    eq(expenses.id, expenseId),
    eq(expenses.workspaceId, workspaceId)
  ));
```

---

## Implementation Checklist for New Features
When building a new feature in ExpenseSplit, follow this flow:
1. **Schema**: Add the required table/columns to `src/database/schema.ts`.
2. **DTO**: Create a Zod schema in the module's `dto/` folder to validate incoming API data.
3. **Repository**: Write the Drizzle queries (`insert`, `findMany`, etc.) in `*.repository.ts`.
4. **Service**: Write the business logic (e.g., checking if an expense is perfectly split mathematically) in `*.service.ts`.
5. **Controller**: Wire up the `@Get()` or `@Post()`, apply the `@UseGuards()`, and pass the validated `@Body()` to the Service in `*.controller.ts`.
