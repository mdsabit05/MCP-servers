import { z } from "zod";
import { eq } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db/index.js";
import { noteLinks } from "../db/schema.js";
import { getNote, listNotes, type NoteWithTags } from "./notes.js";

type Db = typeof db;

export async function getBacklinks(
  database: Db,
  userId: string,
  noteId: string
): Promise<NoteWithTags[]> {
  const rows = await database
    .select({ sourceId: noteLinks.sourceId })
    .from(noteLinks)
    .where(eq(noteLinks.targetId, noteId));

  const sources = await Promise.all(rows.map((r) => getNote(database, userId, r.sourceId)));
  return sources.filter((n): n is NoteWithTags => n !== null);
}

export async function listOrphanNotes(database: Db, userId: string): Promise<NoteWithTags[]> {
  const allNotes = await listNotes(database, userId, 1000, 0);

  const [outgoingLinks, incomingLinks] = await Promise.all([
    database.select({ sourceId: noteLinks.sourceId }).from(noteLinks),
    database.select({ targetId: noteLinks.targetId }).from(noteLinks),
  ]);

  const linkedIds = new Set([
    ...outgoingLinks.map((l) => l.sourceId),
    ...incomingLinks.map((l) => l.targetId),
  ]);

  return allNotes.filter((n) => !linkedIds.has(n.id));
}

export async function getKnowledgeGraph(
  database: Db,
  userId: string
): Promise<{ nodes: { id: string; title: string; tags: string[] }[]; edges: { source: string; target: string }[] }> {
  const allNotes = await listNotes(database, userId, 1000, 0);

  // Only include edges where both source and target belong to this user
  const noteIds = new Set(allNotes.map((n) => n.id));

  const allLinks = await database.select().from(noteLinks);
  const edges = allLinks
    .filter((l) => noteIds.has(l.sourceId) && noteIds.has(l.targetId))
    .map((l) => ({ source: l.sourceId, target: l.targetId }));

  const nodes = allNotes.map((n) => ({ id: n.id, title: n.title, tags: n.tags }));

  return { nodes, edges };
}

export function registerGraphTools(server: McpServer, userId: string): void {
  server.tool(
    "get_note_backlinks",
    "Find all notes that contain a link pointing TO a given note (backlinks)",
    { note_id: z.string().describe("UUID of the note to find backlinks for") },
    async ({ note_id }) => {
      const backlinks = await getBacklinks(db, userId, note_id);
      return { content: [{ type: "text", text: JSON.stringify(backlinks, null, 2) }] };
    }
  );

  server.tool(
    "list_orphan_notes",
    "List all notes that have no incoming or outgoing links — isolated nodes in the knowledge graph",
    {},
    async () => {
      const orphans = await listOrphanNotes(db, userId);
      return { content: [{ type: "text", text: JSON.stringify(orphans, null, 2) }] };
    }
  );

  server.tool(
    "get_knowledge_graph",
    "Return the full knowledge graph as nodes (notes) and edges (links) for visualization",
    {},
    async () => {
      const graph = await getKnowledgeGraph(db, userId);
      return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
    }
  );
}
