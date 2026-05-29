import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db/index.js";
import { notes, noteTags } from "../db/schema.js";

type Db = typeof db;

export interface NoteWithTags {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

async function getTagsForNote(database: Db, noteId: string): Promise<string[]> {
  const rows = await database.select().from(noteTags).where(eq(noteTags.noteId, noteId));
  return rows.map((r) => r.tag);
}

export async function createNote(
  database: Db,
  userId: string,
  input: { title: string; content: string; tags: string[] }
): Promise<NoteWithTags> {
  const id = randomUUID();
  await database.insert(notes).values({ id, userId, title: input.title, content: input.content });
  if (input.tags.length > 0) {
    await database.insert(noteTags).values(input.tags.map((tag) => ({ noteId: id, tag })));
  }
  const [note] = await database.select().from(notes).where(eq(notes.id, id));
  return { ...note, tags: input.tags };
}

export async function getNote(
  database: Db,
  userId: string,
  noteId: string
): Promise<NoteWithTags | null> {
  const [note] = await database
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  if (!note) return null;
  return { ...note, tags: await getTagsForNote(database, noteId) };
}

export async function updateNote(
  database: Db,
  userId: string,
  noteId: string,
  input: { title?: string; content?: string; tags?: string[] }
): Promise<NoteWithTags | null> {
  const existing = await getNote(database, userId, noteId);
  if (!existing) return null;

  const updateData: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) updateData.title = input.title;
  if (input.content !== undefined) updateData.content = input.content;

  await database.update(notes).set(updateData).where(eq(notes.id, noteId));

  if (input.tags !== undefined) {
    await database.delete(noteTags).where(eq(noteTags.noteId, noteId));
    if (input.tags.length > 0) {
      await database.insert(noteTags).values(input.tags.map((tag) => ({ noteId, tag })));
    }
  }

  return getNote(database, userId, noteId);
}

export async function deleteNote(database: Db, userId: string, noteId: string): Promise<boolean> {
  const existing = await getNote(database, userId, noteId);
  if (!existing) return false;
  await database.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  return true;
}

export async function listNotes(
  database: Db,
  userId: string,
  limit = 50,
  offset = 0
): Promise<NoteWithTags[]> {
  const rows = await database
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt))
    .limit(limit)
    .offset(offset);

  return Promise.all(
    rows.map(async (n) => ({ ...n, tags: await getTagsForNote(database, n.id) }))
  );
}

// MCP tool registrations
export function registerNoteTools(server: McpServer, userId: string): void {
  server.tool(
    "create_note",
    "Create a new Zettelkasten note with a title, content, and optional tags",
    {
      title: z.string().min(1).describe("Note title"),
      content: z.string().default("").describe("Note body (Markdown supported)"),
      tags: z.array(z.string()).default([]).describe("List of tags"),
    },
    async ({ title, content, tags }) => {
      const note = await createNote(db, userId, { title, content, tags });
      return {
        content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
      };
    }
  );

  server.tool(
    "get_note",
    "Fetch a single note by its ID",
    { note_id: z.string().describe("The note UUID") },
    async ({ note_id }) => {
      const note = await getNote(db, userId, note_id);
      if (!note) return { content: [{ type: "text", text: "Note not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(note, null, 2) }] };
    }
  );

  server.tool(
    "update_note",
    "Update the title, content, or tags of an existing note",
    {
      note_id: z.string().describe("The note UUID to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content"),
      tags: z.array(z.string()).optional().describe("Replace all tags with this list"),
    },
    async ({ note_id, title, content, tags }) => {
      const note = await updateNote(db, userId, note_id, { title, content, tags });
      if (!note) return { content: [{ type: "text", text: "Note not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(note, null, 2) }] };
    }
  );

  server.tool(
    "delete_note",
    "Permanently delete a note and all its links",
    { note_id: z.string().describe("The note UUID to delete") },
    async ({ note_id }) => {
      const deleted = await deleteNote(db, userId, note_id);
      return {
        content: [{ type: "text", text: deleted ? "Note deleted" : "Note not found" }],
        isError: !deleted,
      };
    }
  );

  server.tool(
    "list_notes",
    "List all notes for the current user, ordered by most recently updated",
    {
      limit: z.number().int().min(1).max(200).default(50).describe("Max notes to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async ({ limit, offset }) => {
      const noteList = await listNotes(db, userId, limit, offset);
      return { content: [{ type: "text", text: JSON.stringify(noteList, null, 2) }] };
    }
  );
}
