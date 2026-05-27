import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark } from '../../src/tools/bookmarks.js';
import { addHighlight, getHighlights, exportHighlights } from '../../src/tools/highlights.js';

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('addHighlight', () => {
  it('saves a highlight with optional note', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    const h = await asUser('u1', () => addHighlight(db, {
      bookmarkId: bm.id,
      text: 'interesting quote',
      note: 'remember this',
      position: 42,
    }));
    expect(h.text).toBe('interesting quote');
    expect(h.note).toBe('remember this');
  });
});

describe('getHighlights', () => {
  it('returns highlights for a bookmark', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'quote 1' }));
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'quote 2' }));
    const list = await asUser('u1', () => getHighlights(db, { bookmarkId: bm.id }));
    expect(list).toHaveLength(2);
  });

  it('rejects access to another users bookmark highlights', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'secret' }));
    const list = await asUser('u2', () => getHighlights(db, { bookmarkId: bm.id }));
    expect(list).toHaveLength(0);
  });
});

describe('exportHighlights', () => {
  it('renders highlights as Markdown', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'My Article' }));
    await asUser('u1', () => addHighlight(db, { bookmarkId: bm.id, text: 'key insight', note: 'important' }));
    const md = await asUser('u1', () => exportHighlights(db, { bookmarkId: bm.id }));
    expect(md).toContain('# Highlights');
    expect(md).toContain('key insight');
    expect(md).toContain('important');
  });
});
