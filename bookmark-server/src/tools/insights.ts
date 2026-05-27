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
