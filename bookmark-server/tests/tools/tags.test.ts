import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import { saveBookmark } from '../../src/tools/bookmarks.js';
import { addTags, removeTags, listTags } from '../../src/tools/tags.js';

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('addTags', () => {
  it('creates tags and attaches them to a bookmark', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    const result = await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['typescript', 'mcp'] }));
    expect(result.tags).toHaveLength(2);
    expect(result.tags.map(t => t.name)).toContain('typescript');
  });

  it('reuses existing tag with same name', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['typescript'] }));
    await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['typescript'] }));
    const all = await asUser('u1', () => listTags(db));
    expect(all.filter(t => t.name === 'typescript')).toHaveLength(1);
  });
});

describe('removeTags', () => {
  it('detaches tags from a bookmark', async () => {
    const bm = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    await asUser('u1', () => addTags(db, { bookmarkId: bm.id, tags: ['a', 'b'] }));
    const result = await asUser('u1', () => removeTags(db, { bookmarkId: bm.id, tags: ['a'] }));
    expect(result.tags.map(t => t.name)).toEqual(['b']);
  });
});

describe('listTags', () => {
  it('returns only the calling users tags', async () => {
    const bm1 = await asUser('u1', () => saveBookmark(db, { url: 'https://u1.com', title: 'U1' }));
    await asUser('u1', () => addTags(db, { bookmarkId: bm1.id, tags: ['private'] }));
    const u2Tags = await asUser('u2', () => listTags(db));
    expect(u2Tags).toHaveLength(0);
  });
});
