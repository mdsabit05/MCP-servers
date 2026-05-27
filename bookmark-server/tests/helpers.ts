import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema.js';
import { runWithUser } from '../src/context.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  // Create tables directly — no migration files needed for tests
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
export function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return runWithUser(userId, fn);
}
