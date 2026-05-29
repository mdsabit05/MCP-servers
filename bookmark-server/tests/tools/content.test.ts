import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark } from '../../src/tools/bookmarks.js';
import { fetchBookmarkContent } from '../../src/tools/content.js';

// Mock the fetcher so tests don't make real network calls
vi.mock('../../src/utils/fetcher.js', () => ({
  fetchAndParse: vi.fn().mockResolvedValue({
    title: 'Mocked Title',
    description: 'Mocked desc',
    content: 'Some article text here with words',
    favicon: 'https://example.com/favicon.ico',
    readingTimeMinutes: 3,
  }),
}));

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('fetchBookmarkContent', () => {
  it('updates bookmark with fetched metadata', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://example.com', title: '' }));
    const updated = await asUser('u1', () => fetchBookmarkContent(db, { id: saved.id }));
    expect(updated?.title).toBe('Mocked Title');
    expect(updated?.content).toBe('Some article text here with words');
    expect(updated?.readingTimeMinutes).toBe(3);
  });

  it('rejects requests for another user bookmark', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://example.com', title: '' }));
    await expect(
      asUser('u2', () => fetchBookmarkContent(db, { id: saved.id })),
    ).rejects.toThrow('not found');
  });
});
