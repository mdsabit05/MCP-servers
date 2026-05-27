import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { createNote } from "./notes.js";
import { linkNotes } from "./links.js";
import { getBacklinks, listOrphanNotes, getKnowledgeGraph } from "./graph.js";

function makeDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE note_tags (note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, tag TEXT NOT NULL, PRIMARY KEY (note_id, tag));
    CREATE TABLE note_links (source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, PRIMARY KEY (source_id, target_id));
  `);
  return drizzle(sqlite, { schema });
}

describe("graph tools", () => {
  it("getBacklinks returns notes pointing to target", async () => {
    const db = makeDb();
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const a = await createNote(db, "u1", { title: "A", content: "", tags: [] });
    const b = await createNote(db, "u1", { title: "B", content: "", tags: [] });
    const c = await createNote(db, "u1", { title: "C", content: "", tags: [] });
    await linkNotes(db, "u1", a.id, c.id);
    await linkNotes(db, "u1", b.id, c.id);

    const backlinks = await getBacklinks(db, "u1", c.id);
    expect(backlinks.map((n) => n.title).sort()).toEqual(["A", "B"]);
  });

  it("listOrphanNotes returns notes with no links", async () => {
    const db = makeDb();
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const a = await createNote(db, "u1", { title: "Connected", content: "", tags: [] });
    await createNote(db, "u1", { title: "Orphan", content: "", tags: [] });
    const c = await createNote(db, "u1", { title: "Other", content: "", tags: [] });
    await linkNotes(db, "u1", a.id, c.id);

    const orphans = await listOrphanNotes(db, "u1");
    expect(orphans.map((n) => n.title)).toContain("Orphan");
    expect(orphans.map((n) => n.title)).not.toContain("Connected");
    expect(orphans.map((n) => n.title)).not.toContain("Other");
  });

  it("getKnowledgeGraph returns correct node and edge counts", async () => {
    const db = makeDb();
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const a = await createNote(db, "u1", { title: "A", content: "", tags: [] });
    const b = await createNote(db, "u1", { title: "B", content: "", tags: [] });
    await linkNotes(db, "u1", a.id, b.id);

    const graph = await getKnowledgeGraph(db, "u1");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });
});
