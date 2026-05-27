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
