import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, asUser, type TestDb } from '../helpers.js';
import {
  saveBookmark, getBookmark, listBookmarks, updateBookmark, deleteBookmark,
} from '../../src/tools/bookmarks.js';

let db: TestDb;
beforeEach(() => { db = createTestDb(); });

describe('saveBookmark', () => {
  it('creates a bookmark and returns its id', async () => {
    const result = await asUser('u1', () => saveBookmark(db, {
      url: 'https://example.com',
      title: 'Example',
    }));
    expect(result.id).toBeTruthy();
    expect(result.url).toBe('https://example.com');
  });

  it('isolates data between users', async () => {
    await asUser('u1', () => saveBookmark(db, { url: 'https://u1.com', title: 'U1' }));
    const u2List = await asUser('u2', () => listBookmarks(db, {}));
    expect(u2List).toHaveLength(0);
  });
});

describe('getBookmark', () => {
  it('returns a bookmark owned by the user', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    const fetched = await asUser('u1', () => getBookmark(db, { id: saved.id }));
    expect(fetched?.url).toBe('https://x.com');
  });

  it('returns null for another users bookmark', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    const fetched = await asUser('u2', () => getBookmark(db, { id: saved.id }));
    expect(fetched).toBeNull();
  });
});

describe('updateBookmark', () => {
  it('updates title and description', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'Old' }));
    await asUser('u1', () => updateBookmark(db, { id: saved.id, title: 'New', description: 'Desc' }));
    const updated = await asUser('u1', () => getBookmark(db, { id: saved.id }));
    expect(updated?.title).toBe('New');
    expect(updated?.description).toBe('Desc');
  });
});

describe('deleteBookmark', () => {
  it('removes the bookmark', async () => {
    const saved = await asUser('u1', () => saveBookmark(db, { url: 'https://x.com', title: 'X' }));
    await asUser('u1', () => deleteBookmark(db, { id: saved.id }));
    const fetched = await asUser('u1', () => getBookmark(db, { id: saved.id }));
    expect(fetched).toBeNull();
  });
});
