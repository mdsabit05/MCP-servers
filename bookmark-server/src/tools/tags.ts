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

  for (const tagId of tagIds) {
    await db.delete(bookmarkTags).where(
      and(eq(bookmarkTags.bookmarkId, input.bookmarkId), eq(bookmarkTags.tagId, tagId)),
    );
  }

  return { bookmarkId: input.bookmarkId, tags: await getBookmarkTags(db, input.bookmarkId, userId) };
}

export async function listTags(db: Db) {
  const userId = getUserId();
  return db.select().from(tags).where(eq(tags.userId, userId));
}
