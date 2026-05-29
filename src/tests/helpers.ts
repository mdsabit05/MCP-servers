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
