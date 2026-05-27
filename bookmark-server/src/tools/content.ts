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
