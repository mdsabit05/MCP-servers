import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import {
  createNote,
  getNote,
  updateNote,
  deleteNote,
  listNotes,
} from "./notes.js";

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

describe("note CRUD", () => {
  it("creates a note and retrieves it", async () => {
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const note = await createNote(db, "u1", { title: "My Idea", content: "Details here", tags: ["idea", "draft"] });
    expect(note.title).toBe("My Idea");
    expect(note.tags).toEqual(["idea", "draft"]);

    const fetched = await getNote(db, "u1", note.id);
    expect(fetched?.content).toBe("Details here");
  });

  it("getNote returns null for another user's note", async () => {
    db.insert(schema.users).values([{ id: "u1", email: "a@b.com" }, { id: "u2", email: "b@c.com" }]).run();
    const note = await createNote(db, "u1", { title: "Private", content: "", tags: [] });
    expect(await getNote(db, "u2", note.id)).toBeNull();
  });

  it("updates a note", async () => {
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const note = await createNote(db, "u1", { title: "Old", content: "old", tags: [] });
    const updated = await updateNote(db, "u1", note.id, { title: "New", tags: ["updated"] });
    expect(updated?.title).toBe("New");
    expect(updated?.tags).toEqual(["updated"]);
  });

  it("deletes a note", async () => {
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    const note = await createNote(db, "u1", { title: "Gone", content: "", tags: [] });
    await deleteNote(db, "u1", note.id);
    expect(await getNote(db, "u1", note.id)).toBeNull();
  });

  it("listNotes only returns user's own notes", async () => {
    db.insert(schema.users).values([{ id: "u1", email: "a@b.com" }, { id: "u2", email: "b@c.com" }]).run();
    await createNote(db, "u1", { title: "U1 Note", content: "", tags: [] });
    await createNote(db, "u2", { title: "U2 Note", content: "", tags: [] });
    const notes = await listNotes(db, "u1");
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("U1 Note");
  });
});
