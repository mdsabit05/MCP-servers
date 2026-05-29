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
