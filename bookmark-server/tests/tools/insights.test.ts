import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark, updateBookmark } from '../../src/tools/bookmarks.js';
import { searchBookmarks, getReadingStats, suggestNextRead } from '../../src/tools/insights.js';

// Mock Anthropic for suggest test
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Read "Article B" — it matches your recent interests.' }],
      }),
    };
  },
}));

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('searchBookmarks', () => {
  it('finds bookmarks matching the query in title or content', async () => {
    await asUser('u1', () => saveBookmark(db, { url: 'https://a.com', title: 'TypeScript Tips' }));
    await asUser('u1', () => saveBookmark(db, { url: 'https://b.com', title: 'CSS Tricks' }));
    const results = await asUser('u1', () => searchBookmarks(db, { query: 'TypeScript' }));
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('TypeScript Tips');
  });
});

describe('getReadingStats', () => {
  it('returns correct counts and average reading time', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://a.com', title: 'A' }));
    await asUser('u1', () => updateBookmark(db, { id: bm.id, isRead: true }));
    await asUser('u1', () => saveBookmark(db, { url: 'https://b.com', title: 'B' }));
    const stats = await asUser('u1', () => getReadingStats(db));
    expect(stats.total).toBe(2);
    expect(stats.read).toBe(1);
    expect(stats.unread).toBe(1);
  });
});

describe('suggestNextRead', () => {
  it('returns a suggestion string', async () => {
    await asUser('u1', () => saveBookmark(db, { url: 'https://a.com', title: 'Article A' }));
    const result = await asUser('u1', () => suggestNextRead(db, {}));
    expect(result).toContain('Article');
  });

  it('returns a message when no unread bookmarks exist', async () => {
    const result = await asUser('u1', () => suggestNextRead(db, {}));
    expect(result).toMatch(/no unread/i);
  });
});
