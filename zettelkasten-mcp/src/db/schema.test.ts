import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users, notes, noteTags, noteLinks } from "./schema.js";
import { eq } from "drizzle-orm";

let db: ReturnType<typeof drizzle>;
let sqlite: Database.Database;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  // Initialize schema manually for in-memory tests
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (note_id, tag)
    );
    CREATE TABLE IF NOT EXISTS note_links (
      source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      PRIMARY KEY (source_id, target_id)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      user_id UNINDEXED,
      title,
      content
    );
  `);
});

afterEach(() => sqlite.close());

describe("notes schema", () => {
  it("inserts and retrieves a note", () => {
    sqlite.exec(`INSERT INTO users (id, email, name) VALUES ('u1', 'a@b.com', 'Alice')`);
    sqlite.exec(`INSERT INTO notes (id, user_id, title, content) VALUES ('n1', 'u1', 'Hello', 'World')`);
    const result = db.select().from(notes).where(eq(notes.id, "n1")).all();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Hello");
  });

  it("cascades delete from note to tags and links", () => {
    sqlite.exec(`INSERT INTO users (id, email, name) VALUES ('u1', 'a@b.com', 'Alice')`);
    sqlite.exec(`INSERT INTO notes (id, user_id, title) VALUES ('n1', 'u1', 'A'), ('n2', 'u1', 'B')`);
    sqlite.exec(`INSERT INTO note_tags VALUES ('n1', 'idea')`);
    sqlite.exec(`INSERT INTO note_links VALUES ('n1', 'n2')`);
    sqlite.exec(`DELETE FROM notes WHERE id = 'n1'`);
    const tags = sqlite.prepare(`SELECT * FROM note_tags WHERE note_id = 'n1'`).all();
    const links = sqlite.prepare(`SELECT * FROM note_links WHERE source_id = 'n1'`).all();
    expect(tags).toHaveLength(0);
    expect(links).toHaveLength(0);
  });
});
