import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, sqlite } from "../db/index.js";
import { notes, noteTags } from "../db/schema.js";
import { getNote, type NoteWithTags } from "./notes.js";

type Db = typeof db;

export async function searchNotes(
  database: Db,
  rawSqlite: Database.Database,
  userId: string,
  query: string,
  limit = 20
): Promise<NoteWithTags[]> {
  // Use FTS5 for full-text search, scoped to the user.
  // Join back to notes table since FTS5 external content table references notes.rowid.
  const rows = rawSqlite
    .prepare(
      `SELECT n.id as note_id
       FROM notes_fts
       JOIN notes n ON n.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
         AND n.user_id = ?
       LIMIT ?`
    )
    .all(query, userId, limit) as { note_id: string }[];

  const found = await Promise.all(rows.map((r) => getNote(database, userId, r.note_id)));
  return found.filter((n): n is NoteWithTags => n !== null);
}

export async function getTags(database: Db, userId: string): Promise<string[]> {
  const userNotes = await database.select({ id: notes.id }).from(notes).where(eq(notes.userId, userId));
  const noteIds = userNotes.map((n) => n.id);
  if (noteIds.length === 0) return [];

  const tagRows = await database
    .selectDistinct({ tag: noteTags.tag })
    .from(noteTags)
    .where(inArray(noteTags.noteId, noteIds));

  return tagRows.map((r) => r.tag).sort();
}

export async function getTagNotes(
  database: Db,
  userId: string,
  tag: string
): Promise<NoteWithTags[]> {
  const rows = await database
    .select({ noteId: noteTags.noteId })
    .from(noteTags)
    .innerJoin(notes, and(eq(notes.id, noteTags.noteId), eq(notes.userId, userId)))
    .where(eq(noteTags.tag, tag));

  const found = await Promise.all(rows.map((r) => getNote(database, userId, r.noteId)));
  return found.filter((n): n is NoteWithTags => n !== null);
}

export function registerSearchTools(server: McpServer, userId: string): void {
  server.tool(
    "search_notes",
    "Full-text search across all note titles and content for the current user",
    {
      query: z.string().min(1).describe("Search terms (supports FTS5 syntax, e.g. 'quantum OR physics')"),
      limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
    },
    async ({ query, limit }) => {
      const results = await searchNotes(db, sqlite, userId, query, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "get_tags",
    "List all unique tags used across the current user's notes",
    {},
    async () => {
      const tags = await getTags(db, userId);
      return { content: [{ type: "text", text: JSON.stringify(tags) }] };
    }
  );

  server.tool(
    "get_tag_notes",
    "Get all notes that have a specific tag",
    { tag: z.string().describe("The tag to filter by") },
    async ({ tag }) => {
      const taggedNotes = await getTagNotes(db, userId, tag);
      return { content: [{ type: "text", text: JSON.stringify(taggedNotes, null, 2) }] };
    }
  );
}
