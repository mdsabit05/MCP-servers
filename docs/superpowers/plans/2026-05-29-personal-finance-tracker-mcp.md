# Personal Finance Tracker MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready MCP server that lets users log transactions, manage accounts, set budgets, and get financial insights through natural conversation, with OAuth authentication via better-auth.

**Architecture:** Single Hono app on port 3000 with two route groups: `/api/auth/*` handled by better-auth (GitHub + Google OAuth), and `/mcp` handled by a per-request McpServer factory. Each MCP request creates a fresh McpServer with tools registered for the authenticated user's `userId`, ensuring per-user data isolation at the structural level.

**Tech Stack:** Node.js 20+, TypeScript, Hono, `@modelcontextprotocol/server`, `@modelcontextprotocol/hono`, better-auth, Drizzle ORM, better-sqlite3, Zod, Vitest

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/db.ts` | Drizzle schema (accounts, transactions, budgets) + SQLite connection + `initSchema()` |
| `src/auth.ts` | better-auth instance with GitHub + Google providers |
| `src/middleware.ts` | Session validation middleware; extracts `userId` from cookie, returns 401 if missing |
| `src/types.ts` | Shared `HonoEnv` type and `CATEGORIES` constant |
| `src/tools/accounts.ts` | `handleCreateAccount`, `handleListAccounts`, `handleUpdateAccountBalance` + `registerAccountTools` |
| `src/tools/transactions.ts` | `handleAddTransaction`, `handleListTransactions`, `handleGetTransaction`, `handleDeleteTransaction` + `registerTransactionTools` |
| `src/tools/budgets.ts` | `handleSetBudget`, `handleListBudgets`, `handleDeleteBudget` + `registerBudgetTools` |
| `src/tools/analytics.ts` | `handleGetMonthlyReport`, `handleGetNetWorth` + `registerAnalyticsTools` |
| `src/tools/generative.ts` | `handleGenerateFinancialInsights` + `registerGenerativeTools` |
| `src/server.ts` | `createMcpServer(userId, db)` — registers all tools on a fresh McpServer |
| `src/index.ts` | Hono app bootstrap: auth routes, session middleware, MCP route, `serve()` |
| `src/tests/helpers.ts` | `createTestDb()` — in-memory SQLite for tests |
| `src/tests/accounts.test.ts` | Tests for account handler functions |
| `src/tests/transactions.test.ts` | Tests for transaction handler functions |
| `src/tests/budgets.test.ts` | Tests for budget handler functions |
| `src/tests/analytics.test.ts` | Tests for analytics handler functions |
| `src/tests/generative.test.ts` | Tests for generative handler function |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `vitest.config.ts` | Vitest config |
| `.env.example` | Environment variable template |
| `.gitignore` | Ignore `finance.db`, `.env`, `node_modules`, `dist` |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "finance-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/hono": "latest",
    "@modelcontextprotocol/server": "latest",
    "@hono/node-server": "latest",
    "better-auth": "latest",
    "better-sqlite3": "latest",
    "drizzle-orm": "latest",
    "hono": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/better-sqlite3": "latest",
    "@types/node": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create `.env.example`**

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_SECRET=your-random-32-char-secret-here
BASE_URL=http://localhost:3000
DATABASE_URL=./finance.db
PORT=3000
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
finance.db
.env
*.db
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example .gitignore
git commit -m "chore: project scaffold"
```

---

## Task 2: Database Schema

**Files:**
- Create: `src/types.ts`
- Create: `src/db.ts`
- Create: `src/tests/helpers.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Health',
  'Shopping',
  'Income',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type TransactionType = 'income' | 'expense'

export type HonoEnv = {
  Variables: {
    userId: string
  }
}
```

- [ ] **Step 2: Create `src/db.ts`**

```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  balance: integer('balance').notNull().default(0),
  createdAt: integer('created_at').notNull(),
})

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountId: text('account_id'),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  category: text('category').notNull(),
  monthlyLimit: integer('monthly_limit').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    monthly_limit INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`

const sqliteInstance = new Database(process.env.DATABASE_URL ?? 'finance.db')
export const db = drizzle(sqliteInstance)
export type DB = typeof db

export function initSchema(): void {
  sqliteInstance.exec(CREATE_TABLES_SQL)
}
```

- [ ] **Step 3: Create `src/tests/helpers.ts`**

```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      monthly_limit INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
  return drizzle(sqlite)
}
```

- [ ] **Step 4: Run tests (nothing to test yet — verify TypeScript compiles)**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/db.ts src/tests/helpers.ts
git commit -m "feat: database schema and test helpers"
```

---

## Task 3: Auth Configuration

**Files:**
- Create: `src/auth.ts`

Note: better-auth manages its own tables (`user`, `session`, `account`, `verification`) separately from our schema. Run `npx @better-auth/cli migrate` after this task to create those tables.

- [ ] **Step 1: Create `src/auth.ts`**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db.js'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  trustedOrigins: [process.env.BASE_URL ?? 'http://localhost:3000'],
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
})
```

- [ ] **Step 2: Run migration to create better-auth tables**

Copy `.env.example` to `.env` and fill in at minimum `BETTER_AUTH_SECRET` and `DATABASE_URL`, then:

```bash
cp .env.example .env
npx @better-auth/cli migrate
```

Expected output: "Migration completed" or similar. Creates `user`, `session`, `account`, `verification` tables in `finance.db`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/auth.ts
git commit -m "feat: better-auth with GitHub and Google OAuth providers"
```

---

## Task 4: Session Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/middleware.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../types.js'

// Mock the auth module before importing middleware
vi.mock('../auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Import after mock
const { auth } = await import('../auth.js')
const { sessionMiddleware } = await import('../middleware.js')

describe('sessionMiddleware', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const app = new Hono<HonoEnv>()
    app.use('/protected', sessionMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('sets userId and calls next when session is valid', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-123', name: 'Test', email: 'test@test.com' },
      session: { id: 'sess-abc' },
    } as any)

    const app = new Hono<HonoEnv>()
    app.use('/protected', sessionMiddleware)
    app.get('/protected', (c) => c.json({ userId: c.get('userId') }))

    const res = await app.request('/protected')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.userId).toBe('user-123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tests/middleware.test.ts
```

Expected: FAIL — `Cannot find module '../middleware.js'`

- [ ] **Step 3: Create `src/middleware.ts`**

```typescript
import type { MiddlewareHandler } from 'hono'
import { auth } from './auth.js'
import type { HonoEnv } from './types.js'

export const sessionMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', session.user.id)
  await next()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/tests/middleware.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/tests/middleware.test.ts
git commit -m "feat: session validation middleware with tests"
```

---

## Task 5: Account Tools

**Files:**
- Create: `src/tools/accounts.ts`
- Create: `src/tests/accounts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/accounts.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { accounts } from '../db.js'
import {
  handleCreateAccount,
  handleListAccounts,
  handleUpdateAccountBalance,
} from '../tools/accounts.js'

const USER_A = 'user-a'
const USER_B = 'user-b'

describe('account tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleCreateAccount', () => {
    it('creates an account and returns it', async () => {
      const result = await handleCreateAccount(db, USER_A, {
        name: 'Chase Checking',
        type: 'checking',
        openingBalance: 1000.50,
      })
      const text = result.content[0].text
      const parsed = JSON.parse(text)
      expect(parsed.name).toBe('Chase Checking')
      expect(parsed.type).toBe('checking')
      expect(parsed.balance).toBe('$1000.50')
    })

    it('stores balance as cents internally', async () => {
      await handleCreateAccount(db, USER_A, {
        name: 'Savings',
        type: 'savings',
        openingBalance: 500.99,
      })
      const rows = await db.select().from(accounts).where(eq(accounts.userId, USER_A))
      expect(rows[0].balance).toBe(50099)
    })
  })

  describe('handleListAccounts', () => {
    it('returns only the requesting user\'s accounts', async () => {
      await handleCreateAccount(db, USER_A, { name: 'A Account', type: 'checking', openingBalance: 0 })
      await handleCreateAccount(db, USER_B, { name: 'B Account', type: 'savings', openingBalance: 0 })

      const result = await handleListAccounts(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('A Account')
    })

    it('returns message when no accounts', async () => {
      const result = await handleListAccounts(db, USER_A)
      expect(result.content[0].text).toContain('No accounts found')
    })
  })

  describe('handleUpdateAccountBalance', () => {
    it('updates balance to new value in cents', async () => {
      const created = await handleCreateAccount(db, USER_A, {
        name: 'Checking',
        type: 'checking',
        openingBalance: 100,
      })
      const accountId = JSON.parse(created.content[0].text).id

      const result = await handleUpdateAccountBalance(db, USER_A, {
        accountId,
        balance: 250.75,
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.balance).toBe('$250.75')
    })

    it('returns error for account not owned by user', async () => {
      const created = await handleCreateAccount(db, USER_B, {
        name: 'B Account',
        type: 'checking',
        openingBalance: 0,
      })
      const accountId = JSON.parse(created.content[0].text).id

      const result = await handleUpdateAccountBalance(db, USER_A, {
        accountId,
        balance: 999,
      })
      expect(result.content[0].text).toContain('not found')
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/tests/accounts.test.ts
```

Expected: FAIL — `Cannot find module '../tools/accounts.js'`

- [ ] **Step 3: Create `src/tools/accounts.ts`**

```typescript
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { accounts } from '../db.js'
import type { DB } from '../db.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleCreateAccount(
  db: DB,
  userId: string,
  params: { name: string; type: string; openingBalance: number },
): Promise<ToolResult> {
  const account = {
    id: randomUUID(),
    userId,
    name: params.name,
    type: params.type,
    balance: Math.round(params.openingBalance * 100),
    createdAt: Date.now(),
  }
  await db.insert(accounts).values(account)
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...account, balance: `$${(account.balance / 100).toFixed(2)}` }),
    }],
  }
}

export async function handleListAccounts(db: DB, userId: string): Promise<ToolResult> {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId))
  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'No accounts found. Create one with create_account.' }] }
  }
  const formatted = rows.map((a) => ({ ...a, balance: `$${(a.balance / 100).toFixed(2)}` }))
  return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
}

export async function handleUpdateAccountBalance(
  db: DB,
  userId: string,
  params: { accountId: string; balance: number },
): Promise<ToolResult> {
  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return { content: [{ type: 'text', text: 'Account not found.' }] }
  }

  const balanceCents = Math.round(params.balance * 100)
  await db
    .update(accounts)
    .set({ balance: balanceCents })
    .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, userId)))

  const updated = { ...existing[0], balance: `$${(balanceCents / 100).toFixed(2)}` }
  return { content: [{ type: 'text', text: JSON.stringify(updated) }] }
}

export function registerAccountTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'create_account',
    {
      description: 'Create a new financial account (checking, savings, credit, cash, or investment) with an opening balance.',
      inputSchema: z.object({
        name: z.string().describe('Account name, e.g. "Chase Checking"'),
        type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment']).describe('Account type'),
        openingBalance: z.number().default(0).describe('Opening balance in dollars, e.g. 1000.50'),
      }),
    },
    (params) => handleCreateAccount(db, userId, params),
  )

  server.registerTool(
    'list_accounts',
    {
      description: 'List all your financial accounts with their current balances.',
      inputSchema: z.object({}),
    },
    () => handleListAccounts(db, userId),
  )

  server.registerTool(
    'update_account_balance',
    {
      description: 'Manually set an account\'s balance in dollars. Useful for corrections or initial sync.',
      inputSchema: z.object({
        accountId: z.string().describe('The account ID to update'),
        balance: z.number().describe('New balance in dollars'),
      }),
    },
    (params) => handleUpdateAccountBalance(db, userId, params),
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/tests/accounts.test.ts
```

Expected: PASS (3 describe blocks, 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/accounts.ts src/tests/accounts.test.ts
git commit -m "feat: account tools (create, list, update balance)"
```

---

## Task 6: Transaction Tools

**Files:**
- Create: `src/tools/transactions.ts`
- Create: `src/tests/transactions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/transactions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { accounts, transactions } from '../db.js'
import { handleCreateAccount } from '../tools/accounts.js'
import {
  handleAddTransaction,
  handleListTransactions,
  handleGetTransaction,
  handleDeleteTransaction,
} from '../tools/transactions.js'

const USER_A = 'user-a'
const USER_B = 'user-b'

async function seedAccount(db: ReturnType<typeof createTestDb>, userId: string, balance = 1000) {
  const result = await handleCreateAccount(db, userId, {
    name: 'Checking',
    type: 'checking',
    openingBalance: balance,
  })
  return JSON.parse(result.content[0].text).id as string
}

describe('transaction tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleAddTransaction', () => {
    it('creates an expense transaction', async () => {
      const result = await handleAddTransaction(db, USER_A, {
        amount: 45.99,
        type: 'expense',
        category: 'Food',
        description: 'Groceries',
        date: '2026-05-15',
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.amount).toBe('$45.99')
      expect(parsed.category).toBe('Food')
      expect(parsed.type).toBe('expense')
    })

    it('decrements account balance for linked expense', async () => {
      const accountId = await seedAccount(db, USER_A, 500)

      await handleAddTransaction(db, USER_A, {
        amount: 100,
        type: 'expense',
        category: 'Shopping',
        description: 'Clothes',
        date: '2026-05-01',
        accountId,
      })

      const rows = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(rows[0].balance).toBe(40000) // $500 - $100 = $400 in cents
    })

    it('increments account balance for linked income', async () => {
      const accountId = await seedAccount(db, USER_A, 500)

      await handleAddTransaction(db, USER_A, {
        amount: 200,
        type: 'income',
        category: 'Income',
        description: 'Salary',
        date: '2026-05-01',
        accountId,
      })

      const rows = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(rows[0].balance).toBe(70000) // $700 in cents
    })

    it('returns error for accountId not owned by user', async () => {
      const accountId = await seedAccount(db, USER_B, 500)

      const result = await handleAddTransaction(db, USER_A, {
        amount: 50,
        type: 'expense',
        category: 'Food',
        description: 'Lunch',
        date: '2026-05-01',
        accountId,
      })
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('handleListTransactions', () => {
    it('returns only the requesting user\'s transactions', async () => {
      await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'A', date: '2026-05-01' })
      await handleAddTransaction(db, USER_B, { amount: 20, type: 'expense', category: 'Food', description: 'B', date: '2026-05-01' })

      const result = await handleListTransactions(db, USER_A, {})
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].description).toBe('A')
    })

    it('filters by category', async () => {
      await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'Lunch', date: '2026-05-01' })
      await handleAddTransaction(db, USER_A, { amount: 50, type: 'expense', category: 'Transport', description: 'Bus', date: '2026-05-02' })

      const result = await handleListTransactions(db, USER_A, { category: 'Food' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].description).toBe('Lunch')
    })

    it('filters by date range', async () => {
      await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'Jan', date: '2026-01-15' })
      await handleAddTransaction(db, USER_A, { amount: 20, type: 'expense', category: 'Food', description: 'May', date: '2026-05-10' })

      const result = await handleListTransactions(db, USER_A, { startDate: '2026-05-01', endDate: '2026-05-31' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].description).toBe('May')
    })
  })

  describe('handleGetTransaction', () => {
    it('returns transaction by id', async () => {
      const added = await handleAddTransaction(db, USER_A, { amount: 99, type: 'expense', category: 'Health', description: 'Doctor', date: '2026-05-01' })
      const id = JSON.parse(added.content[0].text).id

      const result = await handleGetTransaction(db, USER_A, { transactionId: id })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.description).toBe('Doctor')
    })

    it('returns error for transaction owned by another user', async () => {
      const added = await handleAddTransaction(db, USER_B, { amount: 99, type: 'expense', category: 'Health', description: 'Doctor', date: '2026-05-01' })
      const id = JSON.parse(added.content[0].text).id

      const result = await handleGetTransaction(db, USER_A, { transactionId: id })
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('handleDeleteTransaction', () => {
    it('deletes the transaction', async () => {
      const added = await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'Snack', date: '2026-05-01' })
      const id = JSON.parse(added.content[0].text).id

      await handleDeleteTransaction(db, USER_A, { transactionId: id })

      const rows = await db.select().from(transactions).where(eq(transactions.id, id))
      expect(rows).toHaveLength(0)
    })

    it('reverses account balance on deletion of linked expense', async () => {
      const accountId = await seedAccount(db, USER_A, 500)
      const added = await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'Dinner', date: '2026-05-01', accountId })
      const id = JSON.parse(added.content[0].text).id

      // After adding $100 expense: balance = $400
      const before = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(before[0].balance).toBe(40000)

      await handleDeleteTransaction(db, USER_A, { transactionId: id })

      // After reversal: balance = $500 again
      const after = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(after[0].balance).toBe(50000)
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/tests/transactions.test.ts
```

Expected: FAIL — `Cannot find module '../tools/transactions.js'`

- [ ] **Step 3: Create `src/tools/transactions.ts`**

```typescript
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { accounts, transactions } from '../db.js'
import type { DB } from '../db.js'
import { CATEGORIES } from '../types.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleAddTransaction(
  db: DB,
  userId: string,
  params: {
    amount: number
    type: string
    category: string
    description: string
    date: string
    accountId?: string
  },
): Promise<ToolResult> {
  const amountCents = Math.round(params.amount * 100)

  if (params.accountId) {
    const acct = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, userId)))
      .limit(1)

    if (acct.length === 0) {
      return { content: [{ type: 'text', text: 'Account not found.' }] }
    }

    const delta = params.type === 'income' ? amountCents : -amountCents
    await db
      .update(accounts)
      .set({ balance: acct[0].balance + delta })
      .where(eq(accounts.id, params.accountId))
  }

  const tx = {
    id: randomUUID(),
    userId,
    accountId: params.accountId ?? null,
    amount: amountCents,
    type: params.type,
    category: params.category,
    description: params.description,
    date: params.date,
    createdAt: Date.now(),
  }
  await db.insert(transactions).values(tx)

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...tx, amount: `$${(amountCents / 100).toFixed(2)}` }),
    }],
  }
}

export async function handleListTransactions(
  db: DB,
  userId: string,
  params: {
    accountId?: string
    category?: string
    type?: string
    startDate?: string
    endDate?: string
    limit?: number
  },
): Promise<ToolResult> {
  const conditions = [eq(transactions.userId, userId)]
  if (params.accountId) conditions.push(eq(transactions.accountId, params.accountId))
  if (params.category) conditions.push(eq(transactions.category, params.category))
  if (params.type) conditions.push(eq(transactions.type, params.type))
  if (params.startDate) conditions.push(gte(transactions.date, params.startDate))
  if (params.endDate) conditions.push(lte(transactions.date, params.endDate))

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(params.limit ?? 50)

  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'No transactions found.' }] }
  }

  const formatted = rows.map((t) => ({ ...t, amount: `$${(t.amount / 100).toFixed(2)}` }))
  return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
}

export async function handleGetTransaction(
  db: DB,
  userId: string,
  params: { transactionId: string },
): Promise<ToolResult> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))
    .limit(1)

  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'Transaction not found.' }] }
  }

  const t = rows[0]
  return {
    content: [{ type: 'text', text: JSON.stringify({ ...t, amount: `$${(t.amount / 100).toFixed(2)}` }) }],
  }
}

export async function handleDeleteTransaction(
  db: DB,
  userId: string,
  params: { transactionId: string },
): Promise<ToolResult> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))
    .limit(1)

  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'Transaction not found.' }] }
  }

  const tx = rows[0]

  if (tx.accountId) {
    const acct = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, tx.accountId), eq(accounts.userId, userId)))
      .limit(1)

    if (acct.length > 0) {
      const reverseDelta = tx.type === 'income' ? -tx.amount : tx.amount
      await db
        .update(accounts)
        .set({ balance: acct[0].balance + reverseDelta })
        .where(eq(accounts.id, tx.accountId))
    }
  }

  await db
    .delete(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))

  return { content: [{ type: 'text', text: `Transaction ${params.transactionId} deleted.` }] }
}

export function registerTransactionTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'add_transaction',
    {
      description:
        'Log an income or expense transaction. Optionally link it to an account to update that account\'s balance.',
      inputSchema: z.object({
        amount: z.number().positive().describe('Transaction amount in dollars, e.g. 45.99'),
        type: z.enum(['income', 'expense']).describe('Whether this is income or an expense'),
        category: z.enum(CATEGORIES).describe('Spending category'),
        description: z.string().describe('Description of the transaction'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD format'),
        accountId: z.string().optional().describe('Optional account ID to link this transaction to'),
      }),
    },
    (params) => handleAddTransaction(db, userId, params),
  )

  server.registerTool(
    'list_transactions',
    {
      description:
        'List transactions with optional filters by account, category, type, and/or date range.',
      inputSchema: z.object({
        accountId: z.string().optional().describe('Filter by account ID'),
        category: z.enum(CATEGORIES).optional().describe('Filter by category'),
        type: z.enum(['income', 'expense']).optional().describe('Filter by transaction type'),
        startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
        endDate: z.string().optional().describe('End date YYYY-MM-DD'),
        limit: z.number().int().min(1).max(500).default(50).describe('Max results (default 50)'),
      }),
    },
    (params) => handleListTransactions(db, userId, params),
  )

  server.registerTool(
    'get_transaction',
    {
      description: 'Fetch a single transaction by its ID.',
      inputSchema: z.object({
        transactionId: z.string().describe('The transaction ID'),
      }),
    },
    (params) => handleGetTransaction(db, userId, params),
  )

  server.registerTool(
    'delete_transaction',
    {
      description:
        'Delete a transaction. If it was linked to an account, the account balance is reversed.',
      inputSchema: z.object({
        transactionId: z.string().describe('The transaction ID to delete'),
      }),
    },
    (params) => handleDeleteTransaction(db, userId, params),
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/tests/transactions.test.ts
```

Expected: PASS (4 describe blocks, 9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/transactions.ts src/tests/transactions.test.ts
git commit -m "feat: transaction tools (add, list, get, delete) with balance sync"
```

---

## Task 7: Budget Tools

**Files:**
- Create: `src/tools/budgets.ts`
- Create: `src/tests/budgets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/budgets.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers.js'
import { handleAddTransaction } from '../tools/transactions.js'
import {
  handleSetBudget,
  handleListBudgets,
  handleDeleteBudget,
} from '../tools/budgets.js'

const USER_A = 'user-a'

describe('budget tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleSetBudget', () => {
    it('creates a new budget', async () => {
      const result = await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 300 })
      expect(result.content[0].text).toContain('Food')
      expect(result.content[0].text).toContain('$300.00')
    })

    it('updates an existing budget (upsert)', async () => {
      await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 300 })
      const result = await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 400 })
      expect(result.content[0].text).toContain('updated')
      expect(result.content[0].text).toContain('$400.00')
    })
  })

  describe('handleListBudgets', () => {
    it('shows current month spending vs limit', async () => {
      await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 500 })

      const today = new Date().toISOString().slice(0, 10)
      await handleAddTransaction(db, USER_A, {
        amount: 150,
        type: 'expense',
        category: 'Food',
        description: 'Groceries',
        date: today,
      })

      const result = await handleListBudgets(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].category).toBe('Food')
      expect(parsed[0].spent).toBe('$150.00')
      expect(parsed[0].remaining).toBe('$350.00')
      expect(parsed[0].status).toBe('ON TRACK')
    })

    it('marks as OVER BUDGET when spending exceeds limit', async () => {
      await handleSetBudget(db, USER_A, { category: 'Shopping', monthlyLimit: 100 })
      const today = new Date().toISOString().slice(0, 10)
      await handleAddTransaction(db, USER_A, { amount: 150, type: 'expense', category: 'Shopping', description: 'Clothes', date: today })

      const result = await handleListBudgets(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed[0].status).toBe('OVER BUDGET')
    })

    it('returns message when no budgets', async () => {
      const result = await handleListBudgets(db, USER_A)
      expect(result.content[0].text).toContain('No budgets set')
    })
  })

  describe('handleDeleteBudget', () => {
    it('deletes an existing budget', async () => {
      await handleSetBudget(db, USER_A, { category: 'Transport', monthlyLimit: 200 })
      await handleDeleteBudget(db, USER_A, { category: 'Transport' })

      const list = await handleListBudgets(db, USER_A)
      expect(list.content[0].text).toContain('No budgets set')
    })

    it('returns error for non-existent budget', async () => {
      const result = await handleDeleteBudget(db, USER_A, { category: 'Housing' })
      expect(result.content[0].text).toContain('No budget found')
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/tests/budgets.test.ts
```

Expected: FAIL — `Cannot find module '../tools/budgets.js'`

- [ ] **Step 3: Create `src/tools/budgets.ts`**

```typescript
import { and, eq, gte, lte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { budgets, transactions } from '../db.js'
import type { DB } from '../db.js'
import { CATEGORIES } from '../types.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleSetBudget(
  db: DB,
  userId: string,
  params: { category: string; monthlyLimit: number },
): Promise<ToolResult> {
  const limitCents = Math.round(params.monthlyLimit * 100)
  const now = Date.now()

  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(budgets)
      .set({ monthlyLimit: limitCents, updatedAt: now })
      .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))
    return {
      content: [{
        type: 'text',
        text: `Budget for ${params.category} updated to $${params.monthlyLimit.toFixed(2)}/month.`,
      }],
    }
  }

  await db.insert(budgets).values({
    id: randomUUID(),
    userId,
    category: params.category,
    monthlyLimit: limitCents,
    createdAt: now,
    updatedAt: now,
  })
  return {
    content: [{
      type: 'text',
      text: `Budget for ${params.category} set to $${params.monthlyLimit.toFixed(2)}/month.`,
    }],
  }
}

export async function handleListBudgets(db: DB, userId: string): Promise<ToolResult> {
  const allBudgets = await db.select().from(budgets).where(eq(budgets.userId, userId))

  if (allBudgets.length === 0) {
    return { content: [{ type: 'text', text: 'No budgets set. Use set_budget to create one.' }] }
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const monthStart = `${year}-${month}-01`
  const monthEnd = `${year}-${month}-31`

  const monthExpenses = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ),
    )

  const spentByCategory: Record<string, number> = {}
  for (const t of monthExpenses) {
    spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount
  }

  const result = allBudgets.map((b) => {
    const spent = spentByCategory[b.category] ?? 0
    const percentUsed = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0
    return {
      category: b.category,
      limit: `$${(b.monthlyLimit / 100).toFixed(2)}`,
      spent: `$${(spent / 100).toFixed(2)}`,
      remaining: `$${((b.monthlyLimit - spent) / 100).toFixed(2)}`,
      percentUsed: `${percentUsed}%`,
      status: percentUsed >= 100 ? 'OVER BUDGET' : percentUsed >= 80 ? 'WARNING' : 'ON TRACK',
    }
  })

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

export async function handleDeleteBudget(
  db: DB,
  userId: string,
  params: { category: string },
): Promise<ToolResult> {
  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))
    .limit(1)

  if (existing.length === 0) {
    return { content: [{ type: 'text', text: `No budget found for ${params.category}.` }] }
  }

  await db
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))

  return { content: [{ type: 'text', text: `Budget for ${params.category} deleted.` }] }
}

export function registerBudgetTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'set_budget',
    {
      description:
        'Create or update the monthly spending limit for a category. Calling this again for the same category overwrites the previous limit.',
      inputSchema: z.object({
        category: z.enum(CATEGORIES).describe('The spending category'),
        monthlyLimit: z.number().positive().describe('Monthly spending limit in dollars'),
      }),
    },
    (params) => handleSetBudget(db, userId, params),
  )

  server.registerTool(
    'list_budgets',
    {
      description:
        'List all your budgets with the monthly limit, amount spent so far this month, remaining headroom, and status.',
      inputSchema: z.object({}),
    },
    () => handleListBudgets(db, userId),
  )

  server.registerTool(
    'delete_budget',
    {
      description: 'Remove the monthly budget for a given category.',
      inputSchema: z.object({
        category: z.enum(CATEGORIES).describe('The category to remove the budget for'),
      }),
    },
    (params) => handleDeleteBudget(db, userId, params),
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/tests/budgets.test.ts
```

Expected: PASS (3 describe blocks, 7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/budgets.ts src/tests/budgets.test.ts
git commit -m "feat: budget tools (set, list with month spending, delete)"
```

---

## Task 8: Analytics Tools

**Files:**
- Create: `src/tools/analytics.ts`
- Create: `src/tests/analytics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/analytics.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers.js'
import { handleCreateAccount } from '../tools/accounts.js'
import { handleAddTransaction } from '../tools/transactions.js'
import { handleGetMonthlyReport, handleGetNetWorth } from '../tools/analytics.js'

const USER_A = 'user-a'

describe('analytics tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleGetMonthlyReport', () => {
    it('returns totals and breakdown by category', async () => {
      await handleAddTransaction(db, USER_A, { amount: 2000, type: 'income', category: 'Income', description: 'Salary', date: '2026-05-01' })
      await handleAddTransaction(db, USER_A, { amount: 300, type: 'expense', category: 'Food', description: 'Groceries', date: '2026-05-10' })
      await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'Dining', date: '2026-05-15' })
      await handleAddTransaction(db, USER_A, { amount: 50, type: 'expense', category: 'Transport', description: 'Bus', date: '2026-05-20' })

      const result = await handleGetMonthlyReport(db, USER_A, { month: '2026-05' })
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.month).toBe('2026-05')
      expect(parsed.totalIncome).toBe('$2000.00')
      expect(parsed.totalExpenses).toBe('$450.00')
      expect(parsed.net).toBe('$1550.00')
      expect(parsed.byCategory).toHaveLength(2)

      const food = parsed.byCategory.find((c: { category: string }) => c.category === 'Food')
      expect(food.total).toBe('$400.00')
      expect(food.transactionCount).toBe(2)
    })

    it('excludes transactions from other months', async () => {
      await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'April', date: '2026-04-15' })
      await handleAddTransaction(db, USER_A, { amount: 200, type: 'expense', category: 'Food', description: 'May', date: '2026-05-15' })

      const result = await handleGetMonthlyReport(db, USER_A, { month: '2026-05' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.totalExpenses).toBe('$200.00')
    })

    it('excludes other users\' transactions', async () => {
      await handleAddTransaction(db, 'user-b', { amount: 500, type: 'expense', category: 'Food', description: 'B', date: '2026-05-01' })
      await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'A', date: '2026-05-01' })

      const result = await handleGetMonthlyReport(db, USER_A, { month: '2026-05' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.totalExpenses).toBe('$100.00')
    })
  })

  describe('handleGetNetWorth', () => {
    it('sums assets and treats credit as liabilities', async () => {
      await handleCreateAccount(db, USER_A, { name: 'Checking', type: 'checking', openingBalance: 5000 })
      await handleCreateAccount(db, USER_A, { name: 'Savings', type: 'savings', openingBalance: 10000 })
      await handleCreateAccount(db, USER_A, { name: 'Credit Card', type: 'credit', openingBalance: 2000 })

      const result = await handleGetNetWorth(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.totalAssets).toBe('$15000.00')
      expect(parsed.totalLiabilities).toBe('$2000.00')
      expect(parsed.netWorth).toBe('$13000.00')
      expect(parsed.byAccount).toHaveLength(3)
    })

    it('returns zero net worth for user with no accounts', async () => {
      const result = await handleGetNetWorth(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.netWorth).toBe('$0.00')
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/tests/analytics.test.ts
```

Expected: FAIL — `Cannot find module '../tools/analytics.js'`

- [ ] **Step 3: Create `src/tools/analytics.ts`**

```typescript
import { and, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { accounts, transactions } from '../db.js'
import type { DB } from '../db.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleGetMonthlyReport(
  db: DB,
  userId: string,
  params: { month?: string },
): Promise<ToolResult> {
  const targetMonth = params.month ?? new Date().toISOString().slice(0, 7)
  const startDate = `${targetMonth}-01`
  const endDate = `${targetMonth}-31`

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )

  let totalIncomeCents = 0
  let totalExpensesCents = 0
  const byCategoryData: Record<string, { totalCents: number; count: number }> = {}

  for (const t of rows) {
    if (t.type === 'income') {
      totalIncomeCents += t.amount
    } else {
      totalExpensesCents += t.amount
      if (!byCategoryData[t.category]) {
        byCategoryData[t.category] = { totalCents: 0, count: 0 }
      }
      byCategoryData[t.category].totalCents += t.amount
      byCategoryData[t.category].count += 1
    }
  }

  const byCategory = Object.entries(byCategoryData)
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .map(([category, { totalCents, count }]) => ({
      category,
      total: `$${(totalCents / 100).toFixed(2)}`,
      transactionCount: count,
    }))

  const result = {
    month: targetMonth,
    totalIncome: `$${(totalIncomeCents / 100).toFixed(2)}`,
    totalExpenses: `$${(totalExpensesCents / 100).toFixed(2)}`,
    net: `$${((totalIncomeCents - totalExpensesCents) / 100).toFixed(2)}`,
    byCategory,
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

export async function handleGetNetWorth(db: DB, userId: string): Promise<ToolResult> {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId))

  let totalAssetsCents = 0
  let totalLiabilitiesCents = 0

  for (const a of rows) {
    if (a.type === 'credit') {
      totalLiabilitiesCents += a.balance
    } else {
      totalAssetsCents += a.balance
    }
  }

  const result = {
    totalAssets: `$${(totalAssetsCents / 100).toFixed(2)}`,
    totalLiabilities: `$${(totalLiabilitiesCents / 100).toFixed(2)}`,
    netWorth: `$${((totalAssetsCents - totalLiabilitiesCents) / 100).toFixed(2)}`,
    byAccount: rows.map((a) => ({
      name: a.name,
      type: a.type,
      balance: `$${(a.balance / 100).toFixed(2)}`,
      role: a.type === 'credit' ? 'liability' : 'asset',
    })),
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

export function registerAnalyticsTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'get_monthly_report',
    {
      description:
        'Get a full breakdown of income and spending for a given month grouped by category, with totals and a net figure.',
      inputSchema: z.object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe('Month in YYYY-MM format. Defaults to the current month.'),
      }),
    },
    (params) => handleGetMonthlyReport(db, userId, params),
  )

  server.registerTool(
    'get_net_worth',
    {
      description:
        'Calculate your total net worth by summing all account balances. Credit card balances are treated as liabilities.',
      inputSchema: z.object({}),
    },
    () => handleGetNetWorth(db, userId),
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/tests/analytics.test.ts
```

Expected: PASS (2 describe blocks, 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/analytics.ts src/tests/analytics.test.ts
git commit -m "feat: analytics tools (monthly report, net worth)"
```

---

## Task 9: Generative Tool

**Files:**
- Create: `src/tools/generative.ts`
- Create: `src/tests/generative.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/generative.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers.js'
import { handleAddTransaction } from '../tools/transactions.js'
import { handleSetBudget } from '../tools/budgets.js'
import { handleGenerateFinancialInsights } from '../tools/generative.js'

const USER_A = 'user-a'

describe('handleGenerateFinancialInsights', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it('returns all three sections', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await handleAddTransaction(db, USER_A, { amount: 3000, type: 'income', category: 'Income', description: 'Salary', date: today })
    await handleAddTransaction(db, USER_A, { amount: 200, type: 'expense', category: 'Food', description: 'Groceries', date: today })
    await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 300 })

    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text

    expect(text).toContain('## Monthly Summary')
    expect(text).toContain('## Budget Status')
    expect(text).toContain('## Budget Recommendations')
  })

  it('shows over budget status when spending exceeds limit', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await handleAddTransaction(db, USER_A, { amount: 500, type: 'expense', category: 'Shopping', description: 'Clothes', date: today })
    await handleSetBudget(db, USER_A, { category: 'Shopping', monthlyLimit: 100 })

    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text
    expect(text).toContain('OVER BUDGET')
  })

  it('returns graceful message with no transaction history', async () => {
    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text
    expect(text).toContain('## Monthly Summary')
    expect(text).toContain('## Budget Recommendations')
  })

  it('includes budget suggestion based on spending history', async () => {
    const today = new Date().toISOString().slice(0, 10)
    // Add 3 months of food spending so the 3-month average is calculable
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    await handleAddTransaction(db, USER_A, { amount: 300, type: 'expense', category: 'Food', description: 'Food1', date: today })
    await handleAddTransaction(db, USER_A, { amount: 280, type: 'expense', category: 'Food', description: 'Food2', date: lastMonth.toISOString().slice(0, 10) })
    await handleAddTransaction(db, USER_A, { amount: 320, type: 'expense', category: 'Food', description: 'Food3', date: twoMonthsAgo.toISOString().slice(0, 10) })

    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text
    // Suggested budget should appear (avg ~$300, suggestion ~$330 with 10% buffer)
    expect(text).toContain('Food')
    expect(text).toContain('Suggested budget')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/tests/generative.test.ts
```

Expected: FAIL — `Cannot find module '../tools/generative.js'`

- [ ] **Step 3: Create `src/tools/generative.ts`**

```typescript
import { and, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { budgets, transactions } from '../db.js'
import type { DB } from '../db.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

function pctChange(current: number, previous: number): string {
  if (previous === 0) return 'N/A'
  return `${Math.abs(Math.round(((current - previous) / previous) * 100))}%`
}

export async function handleGenerateFinancialInsights(db: DB, userId: string): Promise<ToolResult> {
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = lastMonthDate.toISOString().slice(0, 7)

  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10)

  const [thisMonthTxns, lastMonthTxns, recentExpenses, allBudgets] = await Promise.all([
    db.select().from(transactions).where(
      and(eq(transactions.userId, userId), gte(transactions.date, `${thisMonth}-01`), lte(transactions.date, `${thisMonth}-31`)),
    ),
    db.select().from(transactions).where(
      and(eq(transactions.userId, userId), gte(transactions.date, `${lastMonth}-01`), lte(transactions.date, `${lastMonth}-31`)),
    ),
    db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, threeMonthsAgoStr),
        lte(transactions.date, `${thisMonth}-31`),
      ),
    ),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
  ])

  // Aggregate this month
  let thisIncome = 0
  let thisExpenses = 0
  const thisMonthByCategory: Record<string, number> = {}
  for (const t of thisMonthTxns) {
    if (t.type === 'income') thisIncome += t.amount
    else {
      thisExpenses += t.amount
      thisMonthByCategory[t.category] = (thisMonthByCategory[t.category] ?? 0) + t.amount
    }
  }

  // Aggregate last month
  let lastIncome = 0
  let lastExpenses = 0
  const lastMonthByCategory: Record<string, number> = {}
  for (const t of lastMonthTxns) {
    if (t.type === 'income') lastIncome += t.amount
    else {
      lastExpenses += t.amount
      lastMonthByCategory[t.category] = (lastMonthByCategory[t.category] ?? 0) + t.amount
    }
  }

  // 3-month average by category (for recommendations)
  const threeMonthTotalByCategory: Record<string, number> = {}
  for (const t of recentExpenses) {
    threeMonthTotalByCategory[t.category] = (threeMonthTotalByCategory[t.category] ?? 0) + t.amount
  }
  const avgByCategory: Record<string, number> = {}
  for (const [cat, total] of Object.entries(threeMonthTotalByCategory)) {
    avgByCategory[cat] = Math.round(total / 3)
  }

  const lines: string[] = []

  // Section 1: Monthly Summary
  lines.push('## Monthly Summary', '')
  lines.push(
    `In **${thisMonth}**, you earned **${fmt(thisIncome)}** and spent **${fmt(thisExpenses)}**, ` +
    `for a net of **${fmt(thisIncome - thisExpenses)}**.`,
  )

  if (lastMonthTxns.length > 0) {
    const direction = thisExpenses > lastExpenses ? 'more' : 'less'
    lines.push(
      `Compared to ${lastMonth}, you spent **${pctChange(thisExpenses, lastExpenses)} ${direction}** overall (${fmt(lastExpenses)} last month).`,
    )

    const allCategories = new Set([...Object.keys(thisMonthByCategory), ...Object.keys(lastMonthByCategory)])
    const notable: string[] = []
    for (const cat of allCategories) {
      const curr = thisMonthByCategory[cat] ?? 0
      const prev = lastMonthByCategory[cat] ?? 0
      if (prev > 0 && Math.abs(curr - prev) / prev > 0.2 && Math.abs(curr - prev) > 1000) {
        const dir = curr > prev ? 'more' : 'less'
        notable.push(`${cat}: ${fmt(curr)} (${pctChange(curr, prev)} ${dir} than last month)`)
      }
    }
    if (notable.length > 0) {
      lines.push('', '**Notable changes:**')
      notable.forEach((n) => lines.push(`- ${n}`))
    }
  } else {
    lines.push('No data from last month to compare.')
  }

  // Section 2: Budget Status
  lines.push('', '## Budget Status', '')
  if (allBudgets.length === 0) {
    lines.push('No budgets set. Use `set_budget` to create one.')
  } else {
    for (const b of allBudgets) {
      const spent = thisMonthByCategory[b.category] ?? 0
      const pctUsed = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0
      const statusIcon = pctUsed >= 100 ? '🔴' : pctUsed >= 80 ? '🟡' : '🟢'
      const statusLabel = pctUsed >= 100 ? 'OVER BUDGET' : pctUsed >= 80 ? 'WARNING' : 'ON TRACK'
      lines.push(
        `- **${b.category}**: ${fmt(spent)} of ${fmt(b.monthlyLimit)} (${pctUsed}%) — ${statusIcon} ${statusLabel}`,
      )
    }
  }

  // Section 3: Budget Recommendations
  lines.push('', '## Budget Recommendations', '')
  if (Object.keys(avgByCategory).length === 0) {
    lines.push('Not enough transaction history to make recommendations. Log more transactions first.')
  } else {
    lines.push('Based on your 3-month average spending:')
    for (const [cat, avg] of Object.entries(avgByCategory).sort((a, b) => b[1] - a[1])) {
      const suggestion = Math.round(avg * 1.1) // 10% buffer
      const existing = allBudgets.find((b) => b.category === cat)
      if (existing) {
        const diff = suggestion - existing.monthlyLimit
        if (Math.abs(diff) > 500) {
          const adj = diff > 0 ? 'increasing' : 'decreasing'
          lines.push(
            `- **${cat}**: Consider ${adj} your budget to ${fmt(suggestion)} (currently ${fmt(existing.monthlyLimit)})`,
          )
        }
      } else {
        lines.push(
          `- **${cat}**: Suggested budget of ${fmt(suggestion)}/month (based on ${fmt(avg)} average spend)`,
        )
      }
    }
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}

export function registerGenerativeTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'generate_financial_insights',
    {
      description:
        'Generate a plain-English financial summary with three sections: Monthly Summary (this month vs last), Budget Status (all active budgets), and Budget Recommendations (suggested amounts from 3-month averages).',
      inputSchema: z.object({}),
    },
    () => handleGenerateFinancialInsights(db, userId),
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/tests/generative.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/generative.ts src/tests/generative.test.ts
git commit -m "feat: generative financial insights tool with tests"
```

---

## Task 10: MCP Server Factory + Hono Bootstrap

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/server.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/server'
import type { DB } from './db.js'
import { registerAccountTools } from './tools/accounts.js'
import { registerAnalyticsTools } from './tools/analytics.js'
import { registerBudgetTools } from './tools/budgets.js'
import { registerGenerativeTools } from './tools/generative.js'
import { registerTransactionTools } from './tools/transactions.js'

export function createMcpServer(userId: string, db: DB): McpServer {
  const server = new McpServer({
    name: 'finance-mcp',
    version: '1.0.0',
  })

  registerAccountTools(server, userId, db)
  registerTransactionTools(server, userId, db)
  registerBudgetTools(server, userId, db)
  registerAnalyticsTools(server, userId, db)
  registerGenerativeTools(server, userId, db)

  return server
}
```

- [ ] **Step 2: Create `src/index.ts`**

```typescript
import { serve } from '@hono/node-server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { auth } from './auth.js'
import { db, initSchema } from './db.js'
import { sessionMiddleware } from './middleware.js'
import { createMcpServer } from './server.js'
import type { HonoEnv } from './types.js'

const app = new Hono<HonoEnv>()

// Auth routes — better-auth handles GitHub and Google OAuth flows
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Simple success page users are redirected to after OAuth
app.get('/auth/success', (c) =>
  c.html('<html><body><h1>Signed in successfully.</h1><p>You can close this tab.</p></body></html>'),
)

// All /mcp requests require a valid session
app.use('/mcp', sessionMiddleware)

// MCP route: create a fresh server per request, registered for this user only
app.all('/mcp', async (c) => {
  const userId = c.get('userId')
  const server = createMcpServer(userId, db)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  await server.connect(transport)

  let parsedBody: unknown
  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('application/json')) {
    parsedBody = await c.req.json().catch(() => undefined)
  }

  return transport.handleRequest(c.req.raw, { parsedBody })
})

// Initialize our custom tables then start the server
initSchema()

const port = parseInt(process.env.PORT ?? '3000', 10)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Finance MCP server running on http://localhost:${port}`)
  console.log(`Sign in at: http://localhost:${port}/api/auth/signin/github`)
  console.log(`         or http://localhost:${port}/api/auth/signin/google`)
})
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run all tests to confirm nothing is broken**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "feat: MCP server factory and Hono app bootstrap"
```

---

## Task 11: Environment Setup and Smoke Test

**Files:**
- Modify: `.env` (local only, not committed)

This task verifies the full OAuth + MCP flow manually. It requires real OAuth credentials from GitHub and Google.

- [ ] **Step 1: Register OAuth apps**

  **GitHub:** Go to https://github.com/settings/developers → New OAuth App
  - Homepage URL: `http://localhost:3000`
  - Callback URL: `http://localhost:3000/api/auth/callback/github`
  - Copy Client ID and Client Secret to `.env`

  **Google:** Go to https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth Client ID
  - Application type: Web application
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
  - Copy Client ID and Client Secret to `.env`

- [ ] **Step 2: Fill in `.env`**

```
GITHUB_CLIENT_ID=<from GitHub>
GITHUB_CLIENT_SECRET=<from GitHub>
GOOGLE_CLIENT_ID=<from Google>
GOOGLE_CLIENT_SECRET=<from Google>
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BASE_URL=http://localhost:3000
DATABASE_URL=./finance.db
PORT=3000
```

- [ ] **Step 3: Run better-auth migration**

```bash
npx @better-auth/cli migrate
```

Expected: Migration completes, `finance.db` now has `user`, `session`, `account`, `verification` tables.

- [ ] **Step 4: Start the server**

```bash
npm run dev
```

Expected output:
```
Finance MCP server running on http://localhost:3000
Sign in at: http://localhost:3000/api/auth/signin/github
         or http://localhost:3000/api/auth/signin/google
```

- [ ] **Step 5: Test auth flow**

Open browser at `http://localhost:3000/api/auth/signin/github` → complete GitHub OAuth → should redirect to `/auth/success` page.

- [ ] **Step 6: Test unauthenticated MCP request returns 401**

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | jq .
```

Expected:
```json
{"error": "Unauthorized"}
```

- [ ] **Step 7: Add server to Claude Desktop config**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "finance-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Restart Claude Desktop. The server should appear in the MCP tools list after signing in.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete Personal Finance Tracker MCP server"
```

---

## Full Test Run Verification

After all tasks are complete, run the full test suite:

```bash
npm test
```

Expected output:
```
 ✓ src/tests/middleware.test.ts (2 tests)
 ✓ src/tests/accounts.test.ts (5 tests)
 ✓ src/tests/transactions.test.ts (9 tests)
 ✓ src/tests/budgets.test.ts (7 tests)
 ✓ src/tests/analytics.test.ts (5 tests)
 ✓ src/tests/generative.test.ts (4 tests)

 Test Files  6 passed (6)
 Tests      32 passed (32)
```
