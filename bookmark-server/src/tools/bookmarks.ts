import { eq, and, desc } from 'drizzle-orm';
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
