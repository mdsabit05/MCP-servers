import { describe, it, expect } from 'vitest';
import { bookmarks, tags, bookmarkTags, highlights } from '../src/db/schema.js';

describe('schema exports', () => {
  it('exports bookmarks table', () => {
    expect(bookmarks).toBeDefined();
  });
  it('exports tags table', () => {
    expect(tags).toBeDefined();
  });
  it('exports bookmarkTags table', () => {
    expect(bookmarkTags).toBeDefined();
  });
  it('exports highlights table', () => {
    expect(highlights).toBeDefined();
  });
});
