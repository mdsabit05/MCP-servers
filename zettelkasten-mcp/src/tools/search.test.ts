import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { createNote } from "./notes.js";
import { searchNotes, getTags, getTagNotes } from "./search.js";

function makeDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE note_tags (note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, tag TEXT NOT NULL, PRIMARY KEY (note_id, tag));
    CREATE TABLE note_links (source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, PRIMARY KEY (source_id, target_id));
    CREATE VIRTUAL TABLE notes_fts USING fts5(note_id UNINDEXED, user_id UNINDEXED, title, content);
    CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN INSERT INTO notes_fts(note_id, user_id, title, content) VALUES (new.id, new.user_id, new.title, new.content); END;
    CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN DELETE FROM notes_fts WHERE note_id = old.id; END;
  `);
  return { db: drizzle(sqlite, { schema }), sqlite };
}

describe("search tools", () => {
  it("finds notes by full-text search scoped to user", async () => {
    const { db, sqlite } = makeDb();
    sqlite.exec(`INSERT INTO users VALUES ('u1','a@b.com',null,0),('u2','b@c.com',null,0)`);
    await createNote(db, "u1", { title: "Quantum Physics", content: "wave-particle duality", tags: [] });
    await createNote(db, "u2", { title: "Quantum Cooking", content: "superposition of flavors", tags: [] });

    const results = await searchNotes(db, sqlite, "u1", "quantum");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Quantum Physics");
  });

  it("getTags returns distinct tags for user", async () => {
    const { db } = makeDb();
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    await createNote(db, "u1", { title: "A", content: "", tags: ["idea", "draft"] });
    await createNote(db, "u1", { title: "B", content: "", tags: ["idea", "published"] });
    const tags = await getTags(db, "u1");
    expect(tags.sort()).toEqual(["draft", "idea", "published"]);
  });

  it("getTagNotes returns only notes with the specified tag", async () => {
    const { db } = makeDb();
    db.insert(schema.users).values({ id: "u1", email: "a@b.com" }).run();
    await createNote(db, "u1", { title: "Draft", content: "", tags: ["draft"] });
    await createNote(db, "u1", { title: "Published", content: "", tags: ["published"] });
    const drafts = await getTagNotes(db, "u1", "draft");
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe("Draft");
  });
});
