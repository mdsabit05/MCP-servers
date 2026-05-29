# Bookmark MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully-authenticated bookmark MCP server with 15 tools covering CRUD, tag management, highlights, search, aggregate stats, and AI-powered reading suggestions.

**Architecture:** A single Node.js HTTP server handles both better-auth OAuth routes (`/api/auth/*`) and the MCP Streamable HTTP transport (`/mcp`). Per-request user identity threads through `AsyncLocalStorage` so every tool handler can enforce per-user data isolation without passing user IDs explicitly. A shared `McpServer` instance holds all tool registrations; a fresh `StreamableHTTPServerTransport` is created for each request.

**Tech Stack:** TypeScript 5, `@modelcontextprotocol/sdk`, `better-auth` (bearer + GitHub OAuth), `drizzle-orm` + `better-sqlite3`, `cheerio`, `@anthropic-ai/sdk` (for generative suggestions), `zod`, `vitest`

---

## File Map

```
bookmark-server/
├── src/
│   ├── index.ts                  # HTTP entry point (Node.js http.createServer)
│   ├── context.ts                # AsyncLocalStorage for per-request user identity
│   ├── auth.ts                   # better-auth config (GitHub OAuth + bearer plugin)
│   ├── db/
│   │   ├── schema.ts             # Drizzle app tables (bookmarks, tags, highlights…)
│   │   └── index.ts              # better-sqlite3 + drizzle connection
│   ├── server/
│   │   └── mcp.ts                # McpServer instance with all 15 tools registered
│   ├── tools/
│   │   ├── bookmarks.ts          # save_bookmark, get_bookmark, list_bookmarks,
│   │   │                         #   update_bookmark, delete_bookmark
│   │   ├── content.ts            # fetch_bookmark_content
│   │   ├── tags.ts               # add_tags, remove_tags, list_tags
│   │   ├── highlights.ts         # add_highlight, get_highlights, export_highlights
│   │   └── insights.ts           # search_bookmarks, get_reading_stats,
│   │                             #   suggest_next_read
│   └── utils/
│       └── fetcher.ts            # fetchAndParse(url) → { title, description,
│                                 #   content, favicon, readingTimeMinutes }
├── tests/
│   ├── helpers.ts                # createTestDb(), seedUser(), makeCtx()
│   ├── utils/fetcher.test.ts
│   ├── tools/bookmarks.test.ts
│   ├── tools/content.test.ts
│   ├── tools/tags.test.ts
│   ├── tools/highlights.test.ts
│   └── tools/insights.test.ts
├── drizzle/                      # Generated migration files (gitignored output)
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `bookmark-server/package.json`
- Create: `bookmark-server/tsconfig.json`
- Create: `bookmark-server/.env.example`
- Create: `bookmark-server/drizzle.config.ts`

- [ ] **Step 1: Create the package.json**

```json
{
  "name": "bookmark-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "better-auth": "^1.2.7",
    "better-sqlite3": "^11.10.0",
    "cheerio": "^1.0.0",
    "drizzle-orm": "^0.43.1",
    "node-fetch": "^3.3.2",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.31.1",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

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
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create .env.example**

```env
# GitHub OAuth Application credentials
# Create at: https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Secret used to sign sessions — generate with: openssl rand -hex 32
BETTER_AUTH_SECRET=change_me_to_32_random_bytes

# SQLite database file path (relative to project root)
DATABASE_URL=./bookmarks.db

# Anthropic API key for AI-powered suggestions
ANTHROPIC_API_KEY=your_anthropic_api_key

# Server port
PORT=3000
```

- [ ] **Step 4: Create drizzle.config.ts**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './bookmarks.db',
  },
} satisfies Config;
```

- [ ] **Step 5: Install dependencies**

```bash
cd bookmark-server
npm install
```

Expected: `node_modules` populated, no errors.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: project scaffolding for bookmark MCP server"
```

---

## Task 2: Database Schema & Connection

**Files:**
- Create: `bookmark-server/src/db/schema.ts`
- Create: `bookmark-server/src/db/index.ts`

- [ ] **Step 1: Write the failing test** (verify schema exports exist)

Create `bookmark-server/tests/db.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { bookmarks, tags, bookmarkTags, highlights } from '../src/db/schema.js';

describe('schema exports', () => {
  it('exports bookmarks table', () => {
    expect(bookmarks).toBeDefined();
  });
  it('exports tags table', () => {
    expect(tags).toBeDefined();
  });
  it('exports bookmarkTags table', () => {
    expect(bookmarkTags).toBeDefined();
  });
  it('exports highlights table', () => {
    expect(highlights).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bookmark-server && npx vitest run tests/db.test.ts
```

Expected: FAIL — `Cannot find module '../src/db/schema.js'`

- [ ] **Step 3: Create src/db/schema.ts**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Application tables — better-auth manages its own (user, session, account, verification)

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull().default(''),
  description: text('description').default(''),
  content: text('content').default(''),          // extracted text body
  favicon: text('favicon').default(''),
  readingTimeMinutes: integer('reading_time_minutes').default(0),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  readAt: text('read_at'),                        // ISO-8601 datetime or null
  readingProgress: real('reading_progress').default(0), // 0.0–1.0
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color').default('#6366f1'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const bookmarkTags = sqliteTable('bookmark_tags', {
  bookmarkId: text('bookmark_id').notNull(),
  tagId: text('tag_id').notNull(),
});

export const highlights = sqliteTable('highlights', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookmarkId: text('bookmark_id').notNull(),
  userId: text('user_id').notNull(),
  text: text('text').notNull(),
  note: text('note').default(''),
  position: integer('position').default(0), // character offset in content
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

- [ ] **Step 4: Create src/db/index.ts**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const dbPath = process.env.DATABASE_URL ?? './bookmarks.db';

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
```

- [ ] **Step 5: Run test — should pass**

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Generate & apply migrations for app schema**

```bash
npm run db:push
```

Expected: Tables created in `bookmarks.db`.

- [ ] **Step 7: Commit**

```bash
git add src/db/ drizzle.config.ts tests/db.test.ts
git commit -m "feat: database schema and drizzle connection"
```

---

## Task 3: Auth Configuration

**Files:**
- Create: `bookmark-server/src/auth.ts`

better-auth manages its own tables via `migrate()`. The `bearer()` plugin lets clients pass `Authorization: Bearer <session-token>` instead of cookies — essential for MCP clients.

- [ ] **Step 1: Create src/auth.ts**

```typescript
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index.js';

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me',
  baseURL: `http://localhost:${process.env.PORT ?? 3000}`,
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
  plugins: [
    bearer(), // enables Authorization: Bearer <token> header auth
  ],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
```

- [ ] **Step 2: Run better-auth migrations on startup**

We'll call `auth.api.$migrate()` in the HTTP entry point (Task 12). Verify the export is correct for now by running TypeScript compiler:

```bash
npx tsc --noEmit
```

Expected: No errors (may warn about missing env vars — that's fine).

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "feat: better-auth config with GitHub OAuth and bearer plugin"
```

---

## Task 4: User Context with AsyncLocalStorage

**Files:**
- Create: `bookmark-server/src/context.ts`

Every tool handler calls `getUserId()` — this throws if invoked outside a request context, which prevents accidental data leaks.

- [ ] **Step 1: Write the failing test**

Create `bookmark-server/tests/context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runWithUser, getUserId } from '../src/context.js';

describe('userContext', () => {
  it('provides userId inside runWithUser', async () => {
    let captured = '';
    await runWithUser('user-123', async () => {
      captured = getUserId();
    });
    expect(captured).toBe('user-123');
  });

  it('throws outside runWithUser', () => {
    expect(() => getUserId()).toThrow('No user context');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/context.test.ts
```

Expected: FAIL — `Cannot find module '../src/context.js'`

- [ ] **Step 3: Create src/context.ts**

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface UserCtx {
  userId: string;
}

const storage = new AsyncLocalStorage<UserCtx>();

export function runWithUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ userId }, fn);
}

export function getUserId(): string {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('No user context — tool called outside request handler');
  return ctx.userId;
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx vitest run tests/context.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context.ts tests/context.test.ts
git commit -m "feat: AsyncLocalStorage user context for per-request isolation"
```

---

## Task 5: URL Fetcher Utility

**Files:**
- Create: `bookmark-server/src/utils/fetcher.ts`
- Create: `bookmark-server/tests/utils/fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/utils/fetcher.test.ts
import { describe, it, expect } from 'vitest';
import { fetchAndParse } from '../../src/utils/fetcher.js';

describe('fetchAndParse', () => {
  it('extracts title and text from a URL', async () => {
    // Uses example.com — stable test page
    const result = await fetchAndParse('https://example.com');
    expect(result.title).toBeTruthy();
    expect(result.content).toBeTruthy();
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(0);
  }, 15_000);

  it('returns empty strings for unreachable URL without throwing', async () => {
    const result = await fetchAndParse('http://localhost:19999/nonexistent');
    expect(result.title).toBe('');
    expect(result.content).toBe('');
    expect(result.error).toBeTruthy();
  }, 10_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/utils/fetcher.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/utils/fetcher.ts**

```typescript
import * as cheerio from 'cheerio';

export interface FetchResult {
  title: string;
  description: string;
  content: string;       // cleaned text body
  favicon: string;
  readingTimeMinutes: number;
  error?: string;
}

const WORDS_PER_MINUTE = 200;

export async function fetchAndParse(url: string): Promise<FetchResult> {
  const empty: FetchResult = {
    title: '', description: '', content: '', favicon: '', readingTimeMinutes: 0,
  };

  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'BookmarkServer/1.0 (+https://github.com/bookmark-server)' },
    });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { ...empty, error: String(err) };
  }

  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, footer, header, aside, [role="banner"], [role="navigation"]').remove();

  const title = $('title').first().text().trim()
    || $('h1').first().text().trim()
    || '';

  const description = $('meta[name="description"]').attr('content')?.trim()
    || $('meta[property="og:description"]').attr('content')?.trim()
    || '';

  // Favicon
  const faviconHref = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') ?? '';
  let favicon = '';
  if (faviconHref) {
    try {
      favicon = new URL(faviconHref, url).toString();
    } catch {
      favicon = faviconHref;
    }
  }

  // Body text — prefer <article> or <main>, fall back to <body>
  const contentEl = $('article').first().length
    ? $('article').first()
    : $('main').first().length
      ? $('main').first()
      : $('body');

  const content = contentEl.text().replace(/\s+/g, ' ').trim();
  const wordCount = content.split(' ').filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  return { title, description, content, favicon, readingTimeMinutes };
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx vitest run tests/utils/fetcher.test.ts
```

Expected: PASS (2 tests). The network test hits example.com — skip if offline.

- [ ] **Step 5: Commit**

```bash
git add src/utils/fetcher.ts tests/utils/fetcher.test.ts
git commit -m "feat: URL fetcher with cheerio content extraction"
```

---

## Task 6: Bookmark CRUD Tools

**Tools:** `save_bookmark`, `get_bookmark`, `list_bookmarks`, `update_bookmark`, `delete_bookmark`

**Files:**
- Create: `bookmark-server/src/tools/bookmarks.ts`
- Create: `bookmark-server/tests/helpers.ts`
- Create: `bookmark-server/tests/tools/bookmarks.test.ts`

- [ ] **Step 1: Create the test helper** (`tests/helpers.ts`)

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../src/db/schema.js';
import { runWithUser } from '../src/context.js';
import { bookmarks, tags, bookmarkTags, highlights } from '../src/db/schema.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  // Create tables directly from schema (no migration files needed for tests)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      content TEXT DEFAULT '',
      favicon TEXT DEFAULT '',
      reading_time_minutes INTEGER DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      reading_progress REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id TEXT NOT NULL,
      tag_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      bookmark_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      note TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export type TestDb = ReturnType<typeof createTestDb>;

/** Run a function as a specific user */
export function asUser<T>(userId: string, fn: (db: TestDb) => Promise<T>, db: TestDb): Promise<T> {
  return runWithUser(userId, () => fn(db));
}
```

- [ ] **Step 2: Write the failing bookmark tool tests** (`tests/tools/bookmarks.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import {
  saveBookmark, getBookmark, listBookmarks, updateBookmark, deleteBookmark,
} from '../../src/tools/bookmarks.js';

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('saveBookmark', () => {
  it('creates a bookmark and returns its id', async () => {
    const result = await asUser('u1', () => saveBookmark(db, {
      url: 'https://example.com',
      title: 'Example',
    }), db);
    expect(result.id).toBeTruthy();
    expect(result.url).toBe('https://example.com');
  });

  it('isolates data between users', async () => {
    await asUser('u1', () => saveBookmark(db, { url: 'https://u1.com', title: 'U1' }), db);
    const u2List = await asUser('u2', () => listBookmarks(db, {}), db);
    expect(u2List).toHaveLength(0);
  });
});

describe('getBookmark', () => {
  it('returns a bookmark owned by the user', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    const fetched = await asUser('u1', () => getBookmark(db, { id: saved.id }), db);
    expect(fetched?.url).toBe('https://x.com');
  });

  it('returns null for another users bookmark', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    const fetched = await asUser('u2', () => getBookmark(db, { id: saved.id }), db);
    expect(fetched).toBeNull();
  });
});

describe('updateBookmark', () => {
  it('updates title and description', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'Old' }), db);
    await asUser('u1', () => updateBookmark(db, { id: saved.id, title: 'New', description: 'Desc' }), db);
    const updated = await asUser('u1', () => getBookmark(db, { id: saved.id }), db);
    expect(updated?.title).toBe('New');
    expect(updated?.description).toBe('Desc');
  });
});

describe('deleteBookmark', () => {
  it('removes the bookmark', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    await asUser('u1', () => deleteBookmark(db, { id: saved.id }), db);
    const fetched = await asUser('u1', () => getBookmark(db, { id: saved.id }), db);
    expect(fetched).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/tools/bookmarks.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create src/tools/bookmarks.ts**

```typescript
import { eq, and, desc, like } from 'drizzle-orm';
import { bookmarks } from '../db/schema.js';
import { getUserId } from '../context.js';
import type { Db } from '../db/index.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SaveBookmarkInput {
  url: string;
  title: string;
  description?: string;
}

export interface UpdateBookmarkInput {
  id: string;
  title?: string;
  description?: string;
  isRead?: boolean;
  readingProgress?: number;
}

export interface ListBookmarksInput {
  isRead?: boolean;
  tag?: string;
  limit?: number;
  offset?: number;
}

// ── Tool implementations ───────────────────────────────────────────────────

export async function saveBookmark(db: Db, input: SaveBookmarkInput) {
  const userId = getUserId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(bookmarks).values({
    id,
    userId,
    url: input.url,
    title: input.title,
    description: input.description ?? '',
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
  return row;
}

export async function getBookmark(db: Db, input: { id: string }) {
  const userId = getUserId();
  const [row] = await db.select().from(bookmarks).where(
    and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId)),
  );
  return row ?? null;
}

export async function listBookmarks(db: Db, input: ListBookmarksInput) {
  const userId = getUserId();
  let query = db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
  const rows = await db
    .select()
    .from(bookmarks)
    .where(
      input.isRead !== undefined
        ? and(eq(bookmarks.userId, userId), eq(bookmarks.isRead, input.isRead))
        : eq(bookmarks.userId, userId),
    )
    .orderBy(desc(bookmarks.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return rows;
}

export async function updateBookmark(db: Db, input: UpdateBookmarkInput) {
  const userId = getUserId();
  const updates: Partial<typeof bookmarks.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.isRead !== undefined) {
    updates.isRead = input.isRead;
    updates.readAt = input.isRead ? new Date().toISOString() : null;
  }
  if (input.readingProgress !== undefined) updates.readingProgress = input.readingProgress;

  await db.update(bookmarks)
    .set(updates)
    .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId)));

  return getBookmark(db, { id: input.id });
}

export async function deleteBookmark(db: Db, input: { id: string }) {
  const userId = getUserId();
  await db.delete(bookmarks).where(
    and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId)),
  );
}
```

- [ ] **Step 5: Run tests — should pass**

```bash
npx vitest run tests/tools/bookmarks.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/tools/bookmarks.ts tests/helpers.ts tests/tools/bookmarks.test.ts
git commit -m "feat: bookmark CRUD tools (save, get, list, update, delete)"
```

---

## Task 7: Content Fetch Tool

**Tool:** `fetch_bookmark_content`

**Files:**
- Create: `bookmark-server/src/tools/content.ts`
- Create: `bookmark-server/tests/tools/content.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tools/content.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark } from '../../src/tools/bookmarks.js';
import { fetchBookmarkContent } from '../../src/tools/content.js';

// Mock the fetcher so tests don't make real network calls
vi.mock('../../src/utils/fetcher.js', () => ({
  fetchAndParse: vi.fn().mockResolvedValue({
    title: 'Mocked Title',
    description: 'Mocked desc',
    content: 'Some article text here with words',
    favicon: 'https://example.com/favicon.ico',
    readingTimeMinutes: 3,
  }),
}));

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('fetchBookmarkContent', () => {
  it('updates bookmark with fetched metadata', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://example.com', title: '' }), db);
    const updated = await asUser('u1', () => fetchBookmarkContent(db, { id: saved.id }), db);
    expect(updated?.title).toBe('Mocked Title');
    expect(updated?.content).toBe('Some article text here with words');
    expect(updated?.readingTimeMinutes).toBe(3);
  });

  it('rejects requests for another user's bookmark', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://example.com', title: '' }), db);
    await expect(
      asUser('u2', () => fetchBookmarkContent(db, { id: saved.id }), db),
    ).rejects.toThrow('not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/content.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/tools/content.ts**

```typescript
import { eq, and } from 'drizzle-orm';
import { bookmarks } from '../db/schema.js';
import { getUserId } from '../context.js';
import { fetchAndParse } from '../utils/fetcher.js';
import type { Db } from '../db/index.js';

export async function fetchBookmarkContent(db: Db, input: { id: string }) {
  const userId = getUserId();
  const [bookmark] = await db.select().from(bookmarks).where(
    and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId)),
  );
  if (!bookmark) throw new Error(`Bookmark ${input.id} not found`);

  const parsed = await fetchAndParse(bookmark.url);

  const updates: Partial<typeof bookmarks.$inferInsert> = {
    updatedAt: new Date().toISOString(),
    content: parsed.content,
    favicon: parsed.favicon,
    readingTimeMinutes: parsed.readingTimeMinutes,
  };
  // Only overwrite title/description if they were blank
  if (!bookmark.title && parsed.title) updates.title = parsed.title;
  if (!bookmark.description && parsed.description) updates.description = parsed.description;

  await db.update(bookmarks)
    .set(updates)
    .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId)));

  const [updated] = await db.select().from(bookmarks).where(eq(bookmarks.id, input.id));
  return updated ?? null;
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx vitest run tests/tools/content.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/content.ts tests/tools/content.test.ts
git commit -m "feat: fetch_bookmark_content tool with cheerio extraction"
```

---

## Task 8: Tag Management Tools

**Tools:** `add_tags`, `remove_tags`, `list_tags`

**Files:**
- Create: `bookmark-server/src/tools/tags.ts`
- Create: `bookmark-server/tests/tools/tags.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tools/tags.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark } from '../../src/tools/bookmarks.js';
import { addTags, removeTags, listTags } from '../../src/tools/tags.js';

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('addTags', () => {
  it('creates tags and attaches them to a bookmark', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    const result = await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['typescript', 'mcp'] }), db);
    expect(result.tags).toHaveLength(2);
    expect(result.tags.map(t => t.name)).toContain('typescript');
  });

  it('reuses existing tag with same name', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['typescript'] }), db);
    await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['typescript'] }), db);
    const all = await asUser('u1', () => listTags(db), db);
    expect(all.filter(t => t.name === 'typescript')).toHaveLength(1);
  });
});

describe('removeTags', () => {
  it('detaches tags from a bookmark', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['a', 'b'] }), db);
    const result = await asUser('u1', () => removeTags(db, { bookmarkId: bm.id, tags: ['a'] }), db);
    expect(result.tags.map(t => t.name)).toEqual(['b']);
  });
});

describe('listTags', () => {
  it('returns only the calling users tags', async () => {
    const bm1 = await asUser('u1', () => saveBookmark(db, { url: 'https://u1.com', title: 'U1' }), db);
    await asUser('u1', () => addTags(db, { bookmarkId: bm1.id, tags: ['private'] }), db);
    const u2Tags = await asUser('u2', () => listTags(db), db);
    expect(u2Tags).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/tags.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/tools/tags.ts**

```typescript
import { eq, and, inArray } from 'drizzle-orm';
import { tags, bookmarkTags, bookmarks } from '../db/schema.js';
import { getUserId } from '../context.js';
import type { Db } from '../db/index.js';

async function getBookmarkTags(db: Db, bookmarkId: string, userId: string) {
  const links = await db.select().from(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
  if (links.length === 0) return [];
  const tagIds = links.map(l => l.tagId);
  return db.select().from(tags).where(
    and(inArray(tags.id, tagIds), eq(tags.userId, userId)),
  );
}

export async function addTags(db: Db, input: { bookmarkId: string; tags: string[] }) {
  const userId = getUserId();

  // Verify bookmark ownership
  const [bm] = await db.select().from(bookmarks).where(
    and(eq(bookmarks.id, input.bookmarkId), eq(bookmarks.userId, userId)),
  );
  if (!bm) throw new Error(`Bookmark ${input.bookmarkId} not found`);

  for (const name of input.tags) {
    // Find or create tag
    let [tag] = await db.select().from(tags).where(
      and(eq(tags.userId, userId), eq(tags.name, name)),
    );
    if (!tag) {
      const id = crypto.randomUUID();
      await db.insert(tags).values({ id, userId, name, createdAt: new Date().toISOString() });
      [tag] = await db.select().from(tags).where(eq(tags.id, id));
    }

    // Attach if not already linked
    const existing = await db.select().from(bookmarkTags).where(
      and(eq(bookmarkTags.bookmarkId, input.bookmarkId), eq(bookmarkTags.tagId, tag.id)),
    );
    if (existing.length === 0) {
      await db.insert(bookmarkTags).values({ bookmarkId: input.bookmarkId, tagId: tag.id });
    }
  }

  return { bookmarkId: input.bookmarkId, tags: await getBookmarkTags(db, input.bookmarkId, userId) };
}

export async function removeTags(db: Db, input: { bookmarkId: string; tags: string[] }) {
  const userId = getUserId();

  const tagRows = await db.select().from(tags).where(
    and(eq(tags.userId, userId), inArray(tags.name, input.tags)),
  );
  const tagIds = tagRows.map(t => t.id);

  if (tagIds.length > 0) {
    for (const tagId of tagIds) {
      await db.delete(bookmarkTags).where(
        and(eq(bookmarkTags.bookmarkId, input.bookmarkId), eq(bookmarkTags.tagId, tagId)),
      );
    }
  }

  return { bookmarkId: input.bookmarkId, tags: await getBookmarkTags(db, input.bookmarkId, userId) };
}

export async function listTags(db: Db) {
  const userId = getUserId();
  return db.select().from(tags).where(eq(tags.userId, userId));
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx vitest run tests/tools/tags.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/tags.ts tests/tools/tags.test.ts
git commit -m "feat: tag management tools (add_tags, remove_tags, list_tags)"
```

---

## Task 9: Highlight Tools

**Tools:** `add_highlight`, `get_highlights`, `export_highlights`

**Files:**
- Create: `bookmark-server/src/tools/highlights.ts`
- Create: `bookmark-server/tests/tools/highlights.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tools/highlights.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark } from '../../src/tools/bookmarks.js';
import { addHighlight, getHighlights, exportHighlights } from '../../src/tools/highlights.js';

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('addHighlight', () => {
  it('saves a highlight with optional note', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    const h = await asUser('u1', () => addHighlight(db, {
      bookmarkId: bm.id,
      text: 'interesting quote',
      note: 'remember this',
      position: 42,
    }), db);
    expect(h.text).toBe('interesting quote');
    expect(h.note).toBe('remember this');
  });
});

describe('getHighlights', () => {
  it('returns highlights for a bookmark', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'quote 1' }), db);
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'quote 2' }), db);
    const list = await asUser('u1', () => getHighlights(db, { bookmarkId: bm.id }), db);
    expect(list).toHaveLength(2);
  });

  it('rejects access to another users bookmark highlights', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }), db);
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'secret' }), db);
    const list = await asUser('u2', () => getHighlights(db, { bookmarkId: bm.id }), db);
    expect(list).toHaveLength(0);
  });
});

describe('exportHighlights', () => {
  it('renders highlights as Markdown', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'My Article' }), db);
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'key insight', note: 'important' }), db);
    const md = await asUser('u1', () => exportHighlights(db, { bookmarkId: bm.id }), db);
    expect(md).toContain('# Highlights');
    expect(md).toContain('key insight');
    expect(md).toContain('important');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/highlights.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/tools/highlights.ts**

```typescript
import { eq, and } from 'drizzle-orm';
import { highlights, bookmarks } from '../db/schema.js';
import { getUserId } from '../context.js';
import type { Db } from '../db/index.js';

export async function addHighlight(
  db: Db,
  input: { bookmarkId: string; text: string; note?: string; position?: number },
) {
  const userId = getUserId();
  const id = crypto.randomUUID();
  await db.insert(highlights).values({
    id,
    bookmarkId: input.bookmarkId,
    userId,
    text: input.text,
    note: input.note ?? '',
    position: input.position ?? 0,
    createdAt: new Date().toISOString(),
  });
  const [row] = await db.select().from(highlights).where(eq(highlights.id, id));
  return row;
}

export async function getHighlights(db: Db, input: { bookmarkId: string }) {
  const userId = getUserId();
  return db.select().from(highlights).where(
    and(eq(highlights.bookmarkId, input.bookmarkId), eq(highlights.userId, userId)),
  );
}

export async function exportHighlights(db: Db, input: { bookmarkId: string }) {
  const userId = getUserId();

  const [bookmark] = await db.select().from(bookmarks).where(
    and(eq(bookmarks.id, input.bookmarkId), eq(bookmarks.userId, userId)),
  );
  if (!bookmark) throw new Error(`Bookmark ${input.bookmarkId} not found`);

  const hl = await getHighlights(db, input);

  const lines: string[] = [
    `# Highlights — ${bookmark.title || bookmark.url}`,
    ``,
    `Source: ${bookmark.url}`,
    `Exported: ${new Date().toISOString()}`,
    ``,
  ];

  for (const h of hl) {
    lines.push(`> ${h.text}`);
    if (h.note) lines.push(``, `_${h.note}_`);
    lines.push(``);
  }

  if (hl.length === 0) lines.push('_No highlights yet._');

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx vitest run tests/tools/highlights.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/highlights.ts tests/tools/highlights.test.ts
git commit -m "feat: highlight tools (add_highlight, get_highlights, export_highlights)"
```

---

## Task 10: Insight Tools

**Tools:** `search_bookmarks`, `get_reading_stats`, `suggest_next_read`

**Files:**
- Create: `bookmark-server/src/tools/insights.ts`
- Create: `bookmark-server/tests/tools/insights.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tools/insights.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark, updateBookmark } from '../../src/tools/bookmarks.js';
import { searchBookmarks, getReadingStats, suggestNextRead } from '../../src/tools/insights.js';

// Mock Anthropic for suggest test
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Read "Article B" — it matches your recent interests.' }],
      }),
    };
  },
}));

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('searchBookmarks', () => {
  it('finds bookmarks matching the query in title or content', async () => {
    await asUser('u1', () => saveBookmark(db, { url: 'https://a.com', title: 'TypeScript Tips' }), db);
    await asUser('u1', () => saveBookmark(db, { url: 'https://b.com', title: 'CSS Tricks' }), db);
    const results = await asUser('u1', () => searchBookmarks(db, { query: 'TypeScript' }), db);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('TypeScript Tips');
  });
});

describe('getReadingStats', () => {
  it('returns correct counts and average reading time', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://a.com', title: 'A' }), db);
    await asUser('u1', () => updateBookmark(db, { id: bm.id, isRead: true }), db);
    await asUser('u1', () => saveBookmark(db, { url: 'https://b.com', title: 'B' }), db);
    const stats = await asUser('u1', () => getReadingStats(db), db);
    expect(stats.total).toBe(2);
    expect(stats.read).toBe(1);
    expect(stats.unread).toBe(1);
  });
});

describe('suggestNextRead', () => {
  it('returns a suggestion string', async () => {
    await asUser('u1', () => saveBookmark(db, { url: 'https://a.com', title: 'Article A' }), db);
    const result = await asUser('u1', () => suggestNextRead(db, {}), db);
    expect(result).toContain('Article');
  });

  it('returns a message when no unread bookmarks exist', async () => {
    const result = await asUser('u1', () => suggestNextRead(db, {}), db);
    expect(result).toMatch(/no unread/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/insights.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/tools/insights.ts**

```typescript
import { eq, and, like, or, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { bookmarks } from '../db/schema.js';
import { getUserId } from '../context.js';
import type { Db } from '../db/index.js';

export async function searchBookmarks(db: Db, input: { query: string; limit?: number }) {
  const userId = getUserId();
  const pattern = `%${input.query}%`;
  return db.select().from(bookmarks).where(
    and(
      eq(bookmarks.userId, userId),
      or(
        like(bookmarks.title, pattern),
        like(bookmarks.content, pattern),
        like(bookmarks.description, pattern),
        like(bookmarks.url, pattern),
      ),
    ),
  ).limit(input.limit ?? 20);
}

export async function getReadingStats(db: Db) {
  const userId = getUserId();
  const all = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));

  const total = all.length;
  const read = all.filter(b => b.isRead).length;
  const unread = total - read;
  const totalReadingMinutes = all.reduce((s, b) => s + (b.readingTimeMinutes ?? 0), 0);
  const avgReadingMinutes = total > 0 ? Math.round(totalReadingMinutes / total) : 0;

  const byMonth: Record<string, number> = {};
  for (const b of all.filter(b => b.readAt)) {
    const month = b.readAt!.slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }

  return { total, read, unread, totalReadingMinutes, avgReadingMinutes, byMonth };
}

export async function suggestNextRead(db: Db, input: { focusArea?: string }) {
  const userId = getUserId();

  const unread = await db.select().from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.isRead, false)))
    .orderBy(desc(bookmarks.createdAt))
    .limit(20);

  if (unread.length === 0) return 'You have no unread bookmarks! Time to save some new ones.';

  const recentReads = await db.select().from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.isRead, true)))
    .orderBy(desc(bookmarks.readAt))
    .limit(5);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = [
    'Based on the reading history and unread bookmarks below, suggest ONE article to read next and explain why.',
    '',
    recentReads.length > 0
      ? `Recent reads:\n${recentReads.map(b => `- "${b.title}" (${b.url})`).join('\n')}`
      : 'No reading history yet.',
    '',
    `Unread bookmarks:\n${unread.map((b, i) => `${i + 1}. "${b.title || b.url}" — ${b.description || 'no description'}`).join('\n')}`,
    '',
    input.focusArea ? `User's current focus: ${input.focusArea}` : '',
    '',
    'Give a specific, helpful recommendation in 2-3 sentences.',
  ].filter(Boolean).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const msg = response.content[0];
  return msg.type === 'text' ? msg.text : 'Unable to generate suggestion at this time.';
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npx vitest run tests/tools/insights.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tools/insights.ts tests/tools/insights.test.ts
git commit -m "feat: insight tools (search, stats, AI-powered suggest_next_read)"
```

---

## Task 11: MCP Server Assembly

**Files:**
- Create: `bookmark-server/src/server/mcp.ts`

This file registers all 15 tools on a single `McpServer` instance. Each tool handler calls `getUserId()` from the AsyncLocalStorage context (established in Task 12's HTTP handler).

- [ ] **Step 1: Create src/server/mcp.ts**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  saveBookmark, getBookmark, listBookmarks, updateBookmark, deleteBookmark,
} from '../tools/bookmarks.js';
import { fetchBookmarkContent } from '../tools/content.js';
import { addTags, removeTags, listTags } from '../tools/tags.js';
import { addHighlight, getHighlights, exportHighlights } from '../tools/highlights.js';
import { searchBookmarks, getReadingStats, suggestNextRead } from '../tools/insights.js';

export const mcpServer = new McpServer({
  name: 'bookmark-server',
  version: '0.1.0',
});

// ── 1. save_bookmark ───────────────────────────────────────────────────────
mcpServer.tool(
  'save_bookmark',
  'Save a new URL as a bookmark. Optionally provide a title and description; if omitted, use fetch_bookmark_content afterward to auto-populate them.',
  {
    url: z.string().url().describe('The URL to bookmark'),
    title: z.string().default('').describe('Title of the page (optional)'),
    description: z.string().default('').describe('Short description (optional)'),
  },
  async ({ url, title, description }) => {
    const bookmark = await saveBookmark(db, { url, title, description });
    return { content: [{ type: 'text', text: JSON.stringify(bookmark, null, 2) }] };
  },
);

// ── 2. get_bookmark ────────────────────────────────────────────────────────
mcpServer.tool(
  'get_bookmark',
  'Retrieve a single bookmark by its ID, including its content and tags.',
  { id: z.string().describe('Bookmark ID') },
  async ({ id }) => {
    const bookmark = await getBookmark(db, { id });
    if (!bookmark) return { content: [{ type: 'text', text: 'Bookmark not found.' }] };
    return { content: [{ type: 'text', text: JSON.stringify(bookmark, null, 2) }] };
  },
);

// ── 3. list_bookmarks ──────────────────────────────────────────────────────
mcpServer.tool(
  'list_bookmarks',
  'List your saved bookmarks. Filter by read status, limit results, or paginate with offset.',
  {
    is_read: z.boolean().optional().describe('Filter by read status (omit for all)'),
    limit: z.number().int().min(1).max(100).default(20).describe('Max results (default 20)'),
    offset: z.number().int().min(0).default(0).describe('Pagination offset'),
  },
  async ({ is_read, limit, offset }) => {
    const list = await listBookmarks(db, { isRead: is_read, limit, offset });
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  },
);

// ── 4. update_bookmark ─────────────────────────────────────────────────────
mcpServer.tool(
  'update_bookmark',
  'Update a bookmark\'s title, description, read status, or reading progress (0.0–1.0).',
  {
    id: z.string().describe('Bookmark ID'),
    title: z.string().optional(),
    description: z.string().optional(),
    is_read: z.boolean().optional().describe('Mark as read or unread'),
    reading_progress: z.number().min(0).max(1).optional().describe('Reading progress 0.0–1.0'),
  },
  async ({ id, title, description, is_read, reading_progress }) => {
    const updated = await updateBookmark(db, {
      id, title, description, isRead: is_read, readingProgress: reading_progress,
    });
    return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
  },
);

// ── 5. delete_bookmark ─────────────────────────────────────────────────────
mcpServer.tool(
  'delete_bookmark',
  'Permanently delete a bookmark and all its associated highlights and tags.',
  { id: z.string().describe('Bookmark ID to delete') },
  async ({ id }) => {
    await deleteBookmark(db, { id });
    return { content: [{ type: 'text', text: `Bookmark ${id} deleted.` }] };
  },
);

// ── 6. fetch_bookmark_content ──────────────────────────────────────────────
mcpServer.tool(
  'fetch_bookmark_content',
  'Fetch the URL for an existing bookmark, extract its text, title, description, favicon, and estimated reading time, and save the results to the bookmark.',
  { id: z.string().describe('Bookmark ID to fetch content for') },
  async ({ id }) => {
    const updated = await fetchBookmarkContent(db, { id });
    return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
  },
);

// ── 7. add_tags ────────────────────────────────────────────────────────────
mcpServer.tool(
  'add_tags',
  'Add one or more tags to a bookmark. Tags are created automatically if they don\'t exist.',
  {
    bookmark_id: z.string().describe('Bookmark ID'),
    tags: z.array(z.string().min(1)).min(1).describe('Tag names to add'),
  },
  async ({ bookmark_id, tags }) => {
    const result = await addTags(db, { bookmarkId: bookmark_id, tags });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ── 8. remove_tags ─────────────────────────────────────────────────────────
mcpServer.tool(
  'remove_tags',
  'Remove one or more tags from a bookmark (the tags themselves are kept for reuse).',
  {
    bookmark_id: z.string().describe('Bookmark ID'),
    tags: z.array(z.string().min(1)).min(1).describe('Tag names to remove'),
  },
  async ({ bookmark_id, tags }) => {
    const result = await removeTags(db, { bookmarkId: bookmark_id, tags });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ── 9. list_tags ───────────────────────────────────────────────────────────
mcpServer.tool(
  'list_tags',
  'List all tags you have created, with their IDs and colors.',
  {},
  async () => {
    const tagList = await listTags(db);
    return { content: [{ type: 'text', text: JSON.stringify(tagList, null, 2) }] };
  },
);

// ── 10. add_highlight ──────────────────────────────────────────────────────
mcpServer.tool(
  'add_highlight',
  'Save a text highlight (quote) from a bookmark, with an optional personal note.',
  {
    bookmark_id: z.string().describe('Bookmark ID'),
    text: z.string().min(1).describe('The highlighted text passage'),
    note: z.string().default('').describe('Your personal note about this highlight'),
    position: z.number().int().min(0).default(0).describe('Character offset in the article'),
  },
  async ({ bookmark_id, text, note, position }) => {
    const h = await addHighlight(db, { bookmarkId: bookmark_id, text, note, position });
    return { content: [{ type: 'text', text: JSON.stringify(h, null, 2) }] };
  },
);

// ── 11. get_highlights ─────────────────────────────────────────────────────
mcpServer.tool(
  'get_highlights',
  'Get all highlights you\'ve saved for a specific bookmark.',
  { bookmark_id: z.string().describe('Bookmark ID') },
  async ({ bookmark_id }) => {
    const list = await getHighlights(db, { bookmarkId: bookmark_id });
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  },
);

// ── 12. export_highlights ──────────────────────────────────────────────────
mcpServer.tool(
  'export_highlights',
  'Export all highlights for a bookmark as formatted Markdown, suitable for note-taking apps.',
  { bookmark_id: z.string().describe('Bookmark ID') },
  async ({ bookmark_id }) => {
    const markdown = await exportHighlights(db, { bookmarkId: bookmark_id });
    return { content: [{ type: 'text', text: markdown }] };
  },
);

// ── 13. search_bookmarks ───────────────────────────────────────────────────
mcpServer.tool(
  'search_bookmarks',
  'Search your bookmarks by keyword across title, URL, description, and extracted content.',
  {
    query: z.string().min(1).describe('Search query'),
    limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
  },
  async ({ query, limit }) => {
    const results = await searchBookmarks(db, { query, limit });
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  },
);

// ── 14. get_reading_stats ──────────────────────────────────────────────────
mcpServer.tool(
  'get_reading_stats',
  'Get aggregate reading statistics: total bookmarks, read vs unread counts, total and average reading time, and a month-by-month reading history.',
  {},
  async () => {
    const stats = await getReadingStats(db);
    return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
  },
);

// ── 15. suggest_next_read ──────────────────────────────────────────────────
mcpServer.tool(
  'suggest_next_read',
  'Get an AI-powered suggestion (via Claude) for which unread bookmark to read next, based on your reading history and interests.',
  {
    focus_area: z.string().default('').describe('Optional topic or area to focus on (e.g. "TypeScript", "machine learning")'),
  },
  async ({ focus_area }) => {
    const suggestion = await suggestNextRead(db, { focusArea: focus_area || undefined });
    return { content: [{ type: 'text', text: suggestion }] };
  },
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/mcp.ts
git commit -m "feat: MCP server with all 15 tools registered"
```

---

## Task 12: HTTP Entry Point

**Files:**
- Create: `bookmark-server/src/index.ts`

This is the single-process HTTP server. It:
1. Runs better-auth migrations on startup
2. Routes `/api/auth/*` to better-auth
3. Routes `/mcp` to the MCP Streamable HTTP transport (after session validation)
4. Wraps every MCP request in `runWithUser()` so tools get the authenticated user ID

- [ ] **Step 1: Create src/index.ts**

```typescript
import http from 'http';
import { auth } from './auth.js';
import { mcpServer } from './server/mcp.js';
import { runWithUser } from './context.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ── helpers ────────────────────────────────────────────────────────────────

function nodeHeadersToWeb(headers: http.IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [key, val] of Object.entries(headers)) {
    if (val === undefined) continue;
    webHeaders.set(key, Array.isArray(val) ? val.join(', ') : val);
  }
  return webHeaders;
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function sendWebResponse(webRes: Response, res: http.ServerResponse) {
  res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
  const body = await webRes.arrayBuffer();
  res.end(Buffer.from(body));
}

// ── request handler ────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const rawBody = await readBody(req);

  // ── Auth routes (/api/auth/*) ──────────────────────────────────────────
  if (url.pathname.startsWith('/api/auth')) {
    const webHeaders = nodeHeadersToWeb(req.headers);
    const webReq = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: webHeaders,
      body: rawBody.length > 0 ? rawBody : undefined,
    });
    const webRes = await auth.handler(webReq);
    await sendWebResponse(webRes, res);
    return;
  }

  // ── MCP route (/mcp) ───────────────────────────────────────────────────
  if (url.pathname === '/mcp') {
    // Validate session via bearer token or session cookie
    const webHeaders = nodeHeadersToWeb(req.headers);
    const session = await auth.api.getSession({ headers: webHeaders });

    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized',
        hint: 'Visit /api/auth/sign-in/social?provider=github to sign in, then use the session token as Authorization: Bearer <token>',
      }));
      return;
    }

    let body: unknown;
    try { body = JSON.parse(rawBody.toString('utf-8')); } catch { /* GET or empty */ }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    await runWithUser(session.user.id, async () => {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    });
    return;
  }

  // ── Health check ───────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── startup ────────────────────────────────────────────────────────────────

async function main() {
  // Run better-auth migrations (creates user, session, account, verification tables)
  // @ts-expect-error — migrate is not in the public type but exists at runtime
  await auth.api.$migrate?.();

  server.listen(PORT, () => {
    console.log(`Bookmark MCP Server running on http://localhost:${PORT}`);
    console.log(`  Auth: http://localhost:${PORT}/api/auth/sign-in/social?provider=github`);
    console.log(`  MCP:  http://localhost:${PORT}/mcp`);
  });
}

main().catch(console.error);
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No errors (the one `@ts-expect-error` comment is intentional).

- [ ] **Step 3: Run all tests to ensure nothing is broken**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 4: Smoke-test the server**

In one terminal:
```bash
cp .env.example .env
# Fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_SECRET, ANTHROPIC_API_KEY
npm run dev
```

Expected output:
```
Bookmark MCP Server running on http://localhost:3000
  Auth: http://localhost:3000/api/auth/sign-in/social?provider=github
  MCP:  http://localhost:3000/mcp
```

In another terminal:
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","version":"0.1.0"}`

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
Expected: `{"error":{"code":-32001,"message":"Unauthorized"}}` (no token yet).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: Node.js HTTP entry point with better-auth + MCP routing"
```

---

## Task 13: Claude Code / Claude Desktop Integration

**Files:**
- Create: `bookmark-server/docs/setup.md` (integration guide)

- [ ] **Step 1: Create GitHub OAuth App**

1. Go to https://github.com/settings/developers → "New OAuth App"
2. Application name: `Bookmark MCP Server (local)`
3. Homepage URL: `http://localhost:3000`
4. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
5. Copy **Client ID** and **Client Secret** into your `.env`

- [ ] **Step 2: Generate a secret**

```bash
openssl rand -hex 32
# Paste output as BETTER_AUTH_SECRET in .env
```

- [ ] **Step 3: Start the server**

```bash
npm run dev
```

- [ ] **Step 4: Complete the OAuth login flow to get a session token**

```bash
# 1. Open this URL in your browser to initiate GitHub OAuth:
open "http://localhost:3000/api/auth/sign-in/social?provider=github&callbackURL=http://localhost:3000/api/auth/callback/github"

# 2. After authorizing, GitHub redirects back.
# 3. Get your session token:
curl -s http://localhost:3000/api/auth/get-session \
  -H "Cookie: $(curl -sc /tmp/cookies http://localhost:3000/api/auth/sign-in/social?provider=github -o /dev/null && cat /tmp/cookies | grep -oP 'better-auth.session_token=\K[^ ]+')" \
  | jq '.session.token'
```

Alternatively, just inspect the `better-auth.session_token` cookie in your browser DevTools after the OAuth redirect completes. That value is your bearer token.

- [ ] **Step 5: Add to Claude Code MCP config**

Edit `~/.claude/claude_desktop_config.json` (or `settings.json` for Claude Code):

```json
{
  "mcpServers": {
    "bookmarks": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SESSION_TOKEN_HERE"
      }
    }
  }
}
```

- [ ] **Step 6: Verify all 15 tools are visible**

In Claude Code, run:
```
/mcp
```

Expected: 15 tools listed — `save_bookmark`, `get_bookmark`, `list_bookmarks`, `update_bookmark`, `delete_bookmark`, `fetch_bookmark_content`, `add_tags`, `remove_tags`, `list_tags`, `add_highlight`, `get_highlights`, `export_highlights`, `search_bookmarks`, `get_reading_stats`, `suggest_next_read`.

- [ ] **Step 7: End-to-end smoke test through Claude**

Ask Claude Code:
> "Save https://modelcontextprotocol.io as a bookmark titled 'MCP Docs', fetch its content, then add tags 'mcp' and 'docs', and suggest my next read."

Expected: Claude calls `save_bookmark` → `fetch_bookmark_content` → `add_tags` → `suggest_next_read` in sequence and returns results.

- [ ] **Step 8: Final commit**

```bash
git add docs/setup.md
git commit -m "docs: Claude Code integration guide and OAuth setup instructions"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| OAuth auth via better-auth | Task 3, 12 |
| Bearer token for MCP clients | Task 3 (bearer plugin) |
| 12–15 tools with clear names | Task 11 (15 tools) |
| Read tools | `get_bookmark`, `list_bookmarks`, `get_highlights` |
| Write tools | `save_bookmark`, `update_bookmark`, `delete_bookmark`, `add_tags`, `add_highlight` |
| Computed/aggregate tools | `get_reading_stats`, `search_bookmarks`, `export_highlights` |
| Generative tool | `suggest_next_read` (calls Claude via Anthropic SDK) |
| Persistent storage (SQLite) | Task 2 (drizzle + better-sqlite3) |
| Per-user data isolation | Tasks 4, 6–10 (AsyncLocalStorage + userId filter on every query) |
| Tested via MCP client | Task 13 |
| Real OAuth login flow | Task 13 |

---

## Quick Reference: All 15 Tools

| # | Tool | Type |
|---|---|---|
| 1 | `save_bookmark` | write |
| 2 | `get_bookmark` | read |
| 3 | `list_bookmarks` | read |
| 4 | `update_bookmark` | write |
| 5 | `delete_bookmark` | write |
| 6 | `fetch_bookmark_content` | write + external I/O |
| 7 | `add_tags` | write |
| 8 | `remove_tags` | write |
| 9 | `list_tags` | read |
| 10 | `add_highlight` | write |
| 11 | `get_highlights` | read |
| 12 | `export_highlights` | computed |
| 13 | `search_bookmarks` | computed |
| 14 | `get_reading_stats` | aggregate |
| 15 | `suggest_next_read` | generative (Claude) |
