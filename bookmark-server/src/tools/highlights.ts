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
