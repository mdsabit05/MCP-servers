import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── better-auth required tables ────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ── Application tables ─────────────────────────────────────────────────────

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
