# Personal Finance Tracker MCP Server — Design Spec

**Date:** 2026-05-29

## Overview

A Model Context Protocol (MCP) server that lets users log transactions, manage accounts, set budgets, and get financial insights through natural conversation. Users authenticate via OAuth (GitHub or Google) and can only access their own data.

---

## Architecture

### Approach: Single Express App, Two Route Groups

One Node.js/TypeScript process runs a single Express HTTP server on port 3000:

- `/auth/*` — handled by better-auth (OAuth sign-in, callbacks, session management)
- `/mcp` — handled by the MCP SDK's Streamable HTTP transport

Session validation middleware runs before every MCP request, extracting `userId` from the session and injecting it into request context. All tool handlers receive `userId` exclusively from the session — never as a client-supplied parameter.

### Project Structure

```
finance-mcp/
├── src/
│   ├── index.ts            # Express app bootstrap, mounts auth + MCP routers
│   ├── auth.ts             # better-auth instance (GitHub + Google providers)
│   ├── db.ts               # Drizzle ORM + SQLite setup, schema definitions
│   ├── middleware.ts        # Session validation middleware for /mcp routes
│   ├── tools/
│   │   ├── accounts.ts     # Account CRUD tools
│   │   ├── transactions.ts # Transaction read/write tools
│   │   ├── budgets.ts      # Budget CRUD tools
│   │   ├── analytics.ts    # Aggregate/computed tools
│   │   └── generative.ts   # Financial insights generative tool
│   └── server.ts           # MCP Server instance, registers all tools
├── finance.db              # SQLite database file (gitignored)
├── .env                    # GITHUB_*, GOOGLE_*, BETTER_AUTH_SECRET, BASE_URL
├── .env.example            # Committed env template
└── package.json
```

### Request Flow

```
Browser                     Express App (port 3000)               SQLite
  │                               │                                  │
  ├─ GET /auth/signin/github ─────►│                                  │
  │◄────── redirect to GitHub ────┤                                  │
  ├─ (OAuth dance) ───────────────►│                                  │
  │◄────── session cookie ────────┤                                  │
  │                               │                                  │
MCP Client                        │                                  │
  ├─ POST /mcp (with cookie) ─────►│                                  │
  │                         middleware: getSession()                  │
  │                         → extract userId                         │
  │                         → tool handler(userId, params) ──────────►│
  │◄────── MCP response ──────────┤◄────────── query result ─────────┤
```

---

## Database Schema

All tables (except better-auth's own tables) include a `userId` column. Every query filters by `userId` — cross-user data access is structurally impossible.

Amounts are stored as **integer cents** (e.g. `$12.50` → `1250`) to avoid floating point issues. Currency is USD only.

### `accounts`

| Column      | Type    | Notes                                          |
|-------------|---------|------------------------------------------------|
| id          | text    | UUID, primary key                              |
| userId      | text    | FK to better-auth users table                  |
| name        | text    | e.g. "Chase Checking"                          |
| type        | text    | enum: checking, savings, credit, cash, investment |
| balance     | integer | cents                                          |
| createdAt   | integer | Unix timestamp                                 |

### `transactions`

| Column      | Type    | Notes                                          |
|-------------|---------|------------------------------------------------|
| id          | text    | UUID, primary key                              |
| userId      | text    | FK to better-auth users table                  |
| accountId   | text    | nullable FK to accounts                        |
| amount      | integer | cents, always positive                         |
| type        | text    | enum: income, expense                          |
| category    | text    | enum: Food, Transport, Housing, Entertainment, Health, Shopping, Income, Other |
| description | text    | free-form note                                 |
| date        | text    | ISO date string (YYYY-MM-DD)                   |
| createdAt   | integer | Unix timestamp                                 |

When a transaction is added with an `accountId`, the linked account's `balance` is updated atomically:
- `expense` → balance decreases
- `income` → balance increases

When a transaction is deleted, the balance adjustment is reversed.

### `budgets`

| Column       | Type    | Notes                              |
|--------------|---------|------------------------------------|
| id           | text    | UUID, primary key                  |
| userId       | text    | FK to better-auth users table      |
| category     | text    | same enum as transactions.category |
| monthlyLimit | integer | cents                              |
| createdAt    | integer | Unix timestamp                     |
| updatedAt    | integer | Unix timestamp                     |

`set_budget` is an upsert — one budget row per user per category.

### better-auth tables

Managed automatically by better-auth: `user`, `session`, `account`, `verification`. No custom schema needed.

---

## Tools (13 total)

### Account Tools

#### `create_account`
- **Type:** write
- **Description:** Create a new financial account (checking, savings, credit, cash, or investment) with an opening balance.
- **Parameters:** `name` (string), `type` (enum), `openingBalance` (number, dollars — converted to cents internally)
- **Returns:** The created account object

#### `list_accounts`
- **Type:** read
- **Description:** List all of the user's accounts with their current balances.
- **Parameters:** none
- **Returns:** Array of accounts with balances formatted as dollar strings

#### `update_account_balance`
- **Type:** write
- **Description:** Manually set an account's balance (useful for corrections or initial sync).
- **Parameters:** `accountId` (string), `balance` (number, dollars)
- **Returns:** Updated account object

---

### Transaction Tools

#### `add_transaction`
- **Type:** write
- **Description:** Log an income or expense transaction. Optionally link it to an account to update that account's balance.
- **Parameters:** `amount` (number, dollars), `type` (income|expense), `category` (enum), `description` (string), `date` (YYYY-MM-DD), `accountId` (string, optional)
- **Returns:** Created transaction object

#### `list_transactions`
- **Type:** read
- **Description:** List transactions with optional filters. Supports filtering by account, category, transaction type, and/or date range.
- **Parameters:** `accountId` (string, optional), `category` (enum, optional), `type` (income|expense, optional), `startDate` (YYYY-MM-DD, optional), `endDate` (YYYY-MM-DD, optional), `limit` (integer, optional, default 50)
- **Returns:** Array of transactions, newest first

#### `get_transaction`
- **Type:** read
- **Description:** Fetch a single transaction by its ID.
- **Parameters:** `transactionId` (string)
- **Returns:** Transaction object or error if not found / not owned by user

#### `delete_transaction`
- **Type:** write
- **Description:** Delete a transaction. If it was linked to an account, the account balance is reversed.
- **Parameters:** `transactionId` (string)
- **Returns:** Confirmation message

---

### Budget Tools

#### `set_budget`
- **Type:** write
- **Description:** Create or update the monthly spending limit for a category. One budget per category — calling this again overwrites the previous limit.
- **Parameters:** `category` (enum), `monthlyLimit` (number, dollars)
- **Returns:** Upserted budget object

#### `list_budgets`
- **Type:** read
- **Description:** List all budgets for the current user. For each budget, includes the amount spent so far this calendar month and the remaining headroom.
- **Parameters:** none
- **Returns:** Array of budgets with `{ category, limit, spent, remaining, percentUsed }`

#### `delete_budget`
- **Type:** write
- **Description:** Remove the monthly budget for a given category.
- **Parameters:** `category` (enum)
- **Returns:** Confirmation message

---

### Analytics Tools

#### `get_monthly_report`
- **Type:** aggregate
- **Description:** Returns a full breakdown of income and spending for a given month, grouped by category. Includes totals and a net figure (income minus expenses).
- **Parameters:** `month` (YYYY-MM string, defaults to current month)
- **Returns:** `{ month, totalIncome, totalExpenses, net, byCategory: [{ category, total, transactionCount }] }`

#### `get_net_worth`
- **Type:** aggregate
- **Description:** Calculates total net worth by summing all account balances. Splits by account type (assets vs liabilities for credit accounts).
- **Parameters:** none
- **Returns:** `{ totalAssets, totalLiabilities, netWorth, byAccount: [{ name, type, balance }] }`

---

### Generative Tool

#### `generate_financial_insights`
- **Type:** generative
- **Description:** Produces a plain-English financial summary combining: (1) a narrative of this month's spending vs last month with notable changes called out, (2) which budget categories are over limit or on track, and (3) suggested budget amounts for each active category based on the 3-month rolling average spend. Does not call an external LLM — insight logic is computed server-side and formatted as structured prose.
- **Parameters:** none (uses current month automatically)
- **Returns:** Markdown-formatted narrative string with three sections: Monthly Summary, Budget Status, and Budget Recommendations

---

## Auth Flow

### Sign-In

1. MCP client directs user to `GET /auth/signin/github` or `GET /auth/signin/google`
2. better-auth redirects to the provider's OAuth authorization URL
3. User approves, provider redirects to `/auth/callback/[provider]`
4. better-auth exchanges code for token, creates/updates user + session in SQLite
5. Sets an httpOnly `session` cookie in the browser response
6. Redirects user to a confirmation page (`/auth/success`)

### Session Validation Middleware

Applied to all routes under `/mcp`:

```typescript
const session = await auth.api.getSession({ headers: req.headers })
if (!session) return res.status(401).json({ error: 'Unauthorized' })
req.userId = session.user.id  // injected into all tool handlers
```

### Environment Variables

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_SECRET=        # random 32+ char secret
BASE_URL=http://localhost:3000
DATABASE_URL=./finance.db
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Missing/expired session | HTTP 401 before reaching MCP layer |
| Tool not found | MCP SDK standard error |
| Record not found (wrong ID) | MCP error: "Transaction not found" |
| Record owned by another user | Same as not found — no information leak |
| DB error | MCP error with generic message; raw SQL never exposed |
| Invalid parameter types | Zod validation at tool input boundary; clear message returned |

---

## Technology Stack

| Concern | Library |
|---------|---------|
| Runtime | Node.js 20+, TypeScript |
| MCP transport | `@modelcontextprotocol/sdk` (Streamable HTTP) |
| Auth | `better-auth` with GitHub + Google OAuth plugins |
| HTTP server | Express 4 |
| ORM | Drizzle ORM |
| SQLite driver | `better-sqlite3` |
| Validation | Zod (tool input schemas) |
| Build | `tsx` for dev, `tsc` for production |

---

## Out of Scope

- Multi-currency support or exchange rate conversion
- Recurring/scheduled transactions
- Transaction imports (CSV, Plaid, etc.)
- Email notifications or alerts
- Mobile app or web UI (this is an MCP server only)
