import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db/index.js";
import { noteLinks } from "../db/schema.js";
import { getNote, type NoteWithTags } from "./notes.js";

type Db = typeof db;

export async function linkNotes(
  database: Db,
  userId: string,
  sourceId: string,
  targetId: string
): Promise<void> {
  const source = await getNote(database, userId, sourceId);
  if (!source) throw new Error(`Source note ${sourceId} not found`);
  const target = await getNote(database, userId, targetId);
  if (!target) throw new Error(`Target note ${targetId} not found`);
  if (sourceId === targetId) throw new Error("Cannot link a note to itself");

  await database
    .insert(noteLinks)
    .values({ sourceId, targetId })
    .onConflictDoNothing();
}

export async function unlinkNotes(
  database: Db,
  userId: string,
  sourceId: string,
  targetId: string
): Promise<void> {
  // Verify ownership of source note
  const source = await getNote(database, userId, sourceId);
  if (!source) throw new Error(`Source note ${sourceId} not found`);
  await database
    .delete(noteLinks)
    .where(and(eq(noteLinks.sourceId, sourceId), eq(noteLinks.targetId, targetId)));
}

export async function getLinksForNote(
  database: Db,
  userId: string,
  noteId: string
): Promise<{ outgoing: NoteWithTags[]; incoming: NoteWithTags[] }> {
  // Outgoing: notes this note points to
  const outgoingLinks = await database
    .select({ targetId: noteLinks.targetId })
    .from(noteLinks)
    .where(eq(noteLinks.sourceId, noteId));

  // Incoming: notes that point to this note
  const incomingLinks = await database
    .select({ sourceId: noteLinks.sourceId })
    .from(noteLinks)
    .where(eq(noteLinks.targetId, noteId));

  const outgoing = (
    await Promise.all(outgoingLinks.map((l) => getNote(database, userId, l.targetId)))
  ).filter((n): n is NoteWithTags => n !== null);

  const incoming = (
    await Promise.all(incomingLinks.map((l) => getNote(database, userId, l.sourceId)))
  ).filter((n): n is NoteWithTags => n !== null);

  return { outgoing, incoming };
}

export function registerLinkTools(server: McpServer, userId: string): void {
  server.tool(
    "link_notes",
    "Create a directional link from one note to another (like a wiki-link [[A]] → [[B]])",
    {
      source_id: z.string().describe("UUID of the source note"),
      target_id: z.string().describe("UUID of the target note"),
    },
    async ({ source_id, target_id }) => {
      try {
        await linkNotes(db, userId, source_id, target_id);
        return { content: [{ type: "text", text: `Linked ${source_id} → ${target_id}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
    }
  );

  server.tool(
    "unlink_notes",
    "Remove the directional link between two notes",
    {
      source_id: z.string().describe("UUID of the source note"),
      target_id: z.string().describe("UUID of the target note"),
    },
    async ({ source_id, target_id }) => {
      try {
        await unlinkNotes(db, userId, source_id, target_id);
        return { content: [{ type: "text", text: `Unlinked ${source_id} → ${target_id}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
    }
  );
}
