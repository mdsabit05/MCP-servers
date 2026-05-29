import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { createNote } from "./notes.js";
import { linkNotes, unlinkNotes, getLinksForNote } from "./links.js";

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

let db: ReturnType<typeof makeDb>;

beforeEach(() => { db = makeDb(); });

describe("link tools", () => {
  it("creates and removes a link between two notes", async () => {
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const a = await createNote(db, "u1", { title: "A", content: "", tags: [] });
    const b = await createNote(db, "u1", { title: "B", content: "", tags: [] });

    await linkNotes(db, "u1", a.id, b.id);
    const links = await getLinksForNote(db, "u1", a.id);
    expect(links.outgoing.map((n) => n.id)).toContain(b.id);

    await unlinkNotes(db, "u1", a.id, b.id);
    const afterUnlink = await getLinksForNote(db, "u1", a.id);
    expect(afterUnlink.outgoing).toHaveLength(0);
  });

  it("prevents linking notes belonging to different users", async () => {
    db.insert(schema.users).values([{ id: "u1", email: "a@b.com" }, { id: "u2", email: "b@c.com" }]).run();
    const a = await createNote(db, "u1", { title: "A", content: "", tags: [] });
    const b = await createNote(db, "u2", { title: "B", content: "", tags: [] });
    await expect(linkNotes(db, "u1", a.id, b.id)).rejects.toThrow("not found");
  });
});
