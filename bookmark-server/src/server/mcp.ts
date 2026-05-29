import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  saveBookmark, getBookmark, listBookmarks, updateBookmark, deleteBookmark,
} from '../tools/bookmarks.js';
import { fetchBookmarkContent } from '../tools/content.js';
import { addTags, removeTags, listTags } from '../tools/tags.js';
import { addHighlight, getHighlights, exportHighlights } from '../tools/highlights.js';
import { searchBookmarks, getReadingStats, suggestNextRead } from '../tools/insights.js';

/**
 * Factory: creates a fresh McpServer with all 15 tools registered.
 * Called once per HTTP request so each transport gets its own server instance,
 * which avoids transport state collisions under concurrent requests.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'bookmark-server', version: '0.1.0' });

  // ── 1. save_bookmark ─────────────────────────────────────────────────────
  server.registerTool('save_bookmark', {
    description: 'Save a new URL as a bookmark. Optionally provide a title and description; if omitted, use fetch_bookmark_content afterward to auto-populate them.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to bookmark'),
      title: z.string().default('').describe('Title of the page (optional)'),
      description: z.string().default('').describe('Short description (optional)'),
    }),
  }, async ({ url, title, description }) => {
    const bookmark = await saveBookmark(db, { url, title, description });
    return { content: [{ type: 'text', text: JSON.stringify(bookmark, null, 2) }] };
  });

  // ── 2. get_bookmark ───────────────────────────────────────────────────────
  server.registerTool('get_bookmark', {
    description: 'Retrieve a single bookmark by its ID, including all its stored metadata.',
    inputSchema: z.object({
      id: z.string().describe('Bookmark ID'),
    }),
  }, async ({ id }) => {
    const bookmark = await getBookmark(db, { id });
    if (!bookmark) return { content: [{ type: 'text', text: 'Bookmark not found.' }] };
    return { content: [{ type: 'text', text: JSON.stringify(bookmark, null, 2) }] };
  });

  // ── 3. list_bookmarks ─────────────────────────────────────────────────────
  server.registerTool('list_bookmarks', {
    description: 'List your saved bookmarks. Filter by read status, limit results, or paginate with offset.',
    inputSchema: z.object({
      is_read: z.boolean().optional().describe('Filter by read status (omit for all)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results (default 20)'),
      offset: z.number().int().min(0).default(0).describe('Pagination offset'),
    }),
  }, async ({ is_read, limit, offset }) => {
    const list = await listBookmarks(db, { isRead: is_read, limit, offset });
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  });

  // ── 4. update_bookmark ────────────────────────────────────────────────────
  server.registerTool('update_bookmark', {
    description: "Update a bookmark's title, description, read status, or reading progress (0.0–1.0).",
    inputSchema: z.object({
      id: z.string().describe('Bookmark ID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      is_read: z.boolean().optional().describe('Mark as read or unread'),
      reading_progress: z.number().min(0).max(1).optional().describe('Reading progress 0.0–1.0'),
    }),
  }, async ({ id, title, description, is_read, reading_progress }) => {
    const updated = await updateBookmark(db, {
      id, title, description, isRead: is_read, readingProgress: reading_progress,
    });
    return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
  });

  // ── 5. delete_bookmark ────────────────────────────────────────────────────
  server.registerTool('delete_bookmark', {
    description: 'Permanently delete a bookmark and all its associated highlights.',
    inputSchema: z.object({
      id: z.string().describe('Bookmark ID to delete'),
    }),
  }, async ({ id }) => {
    await deleteBookmark(db, { id });
    return { content: [{ type: 'text', text: `Bookmark ${id} deleted.` }] };
  });

  // ── 6. fetch_bookmark_content ─────────────────────────────────────────────
  server.registerTool('fetch_bookmark_content', {
    description: 'Fetch the URL for an existing bookmark, extract its text, title, description, favicon, and estimated reading time, and save the results to the bookmark.',
    inputSchema: z.object({
      id: z.string().describe('Bookmark ID to fetch content for'),
    }),
  }, async ({ id }) => {
    const updated = await fetchBookmarkContent(db, { id });
    return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
  });

  // ── 7. add_tags ───────────────────────────────────────────────────────────
  server.registerTool('add_tags', {
    description: "Add one or more tags to a bookmark. Tags are created automatically if they don't exist.",
    inputSchema: z.object({
      bookmark_id: z.string().describe('Bookmark ID'),
      tags: z.array(z.string().min(1)).min(1).describe('Tag names to add'),
    }),
  }, async ({ bookmark_id, tags }) => {
    const result = await addTags(db, { bookmarkId: bookmark_id, tags });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ── 8. remove_tags ────────────────────────────────────────────────────────
  server.registerTool('remove_tags', {
    description: 'Remove one or more tags from a bookmark (the tags themselves are kept for reuse).',
    inputSchema: z.object({
      bookmark_id: z.string().describe('Bookmark ID'),
      tags: z.array(z.string().min(1)).min(1).describe('Tag names to remove'),
    }),
  }, async ({ bookmark_id, tags }) => {
    const result = await removeTags(db, { bookmarkId: bookmark_id, tags });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ── 9. list_tags ──────────────────────────────────────────────────────────
  server.registerTool('list_tags', {
    description: 'List all tags you have created, with their IDs and colors.',
    inputSchema: z.object({}),
  }, async () => {
    const tagList = await listTags(db);
    return { content: [{ type: 'text', text: JSON.stringify(tagList, null, 2) }] };
  });

  // ── 10. add_highlight ─────────────────────────────────────────────────────
  server.registerTool('add_highlight', {
    description: 'Save a text highlight (quote) from a bookmark, with an optional personal note.',
    inputSchema: z.object({
      bookmark_id: z.string().describe('Bookmark ID'),
      text: z.string().min(1).describe('The highlighted text passage'),
      note: z.string().default('').describe('Your personal note about this highlight'),
      position: z.number().int().min(0).default(0).describe('Character offset in the article'),
    }),
  }, async ({ bookmark_id, text, note, position }) => {
    const h = await addHighlight(db, { bookmarkId: bookmark_id, text, note, position });
    return { content: [{ type: 'text', text: JSON.stringify(h, null, 2) }] };
  });

  // ── 11. get_highlights ────────────────────────────────────────────────────
  server.registerTool('get_highlights', {
    description: "Get all highlights you've saved for a specific bookmark.",
    inputSchema: z.object({
      bookmark_id: z.string().describe('Bookmark ID'),
    }),
  }, async ({ bookmark_id }) => {
    const list = await getHighlights(db, { bookmarkId: bookmark_id });
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  });

  // ── 12. export_highlights ─────────────────────────────────────────────────
  server.registerTool('export_highlights', {
    description: 'Export all highlights for a bookmark as formatted Markdown, suitable for note-taking apps.',
    inputSchema: z.object({
      bookmark_id: z.string().describe('Bookmark ID'),
    }),
  }, async ({ bookmark_id }) => {
    const markdown = await exportHighlights(db, { bookmarkId: bookmark_id });
    return { content: [{ type: 'text', text: markdown }] };
  });

  // ── 13. search_bookmarks ──────────────────────────────────────────────────
  server.registerTool('search_bookmarks', {
    description: 'Search your bookmarks by keyword across title, URL, description, and extracted content.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Search query'),
      limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
    }),
  }, async ({ query, limit }) => {
    const results = await searchBookmarks(db, { query, limit });
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  });

  // ── 14. get_reading_stats ─────────────────────────────────────────────────
  server.registerTool('get_reading_stats', {
    description: 'Get aggregate reading statistics: total bookmarks, read vs unread counts, total and average reading time, and a month-by-month reading history.',
    inputSchema: z.object({}),
  }, async () => {
    const stats = await getReadingStats(db);
    return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
  });

  // ── 15. suggest_next_read ─────────────────────────────────────────────────
  server.registerTool('suggest_next_read', {
    description: 'Get an AI-powered suggestion (via Claude) for which unread bookmark to read next, based on your reading history and interests.',
    inputSchema: z.object({
      focus_area: z.string().default('').describe('Optional topic to focus on (e.g. "TypeScript", "machine learning")'),
    }),
  }, async ({ focus_area }) => {
    const suggestion = await suggestNextRead(db, { focusArea: focus_area || undefined });
    return { content: [{ type: 'text', text: suggestion }] };
  });

  return server;
}
