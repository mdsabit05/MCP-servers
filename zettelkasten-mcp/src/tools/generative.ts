import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db/index.js";
import { getNote, listNotes } from "./notes.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function registerGenerativeTools(server: McpServer, userId: string): void {
  server.tool(
    "summarize_note",
    "Use AI to generate a concise summary of a note's content (1-3 sentences)",
    { note_id: z.string().describe("UUID of the note to summarize") },
    async ({ note_id }) => {
      const note = await getNote(db, userId, note_id);
      if (!note) {
        return { content: [{ type: "text", text: "Note not found" }], isError: true };
      }

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Summarize the following note in 1-3 clear, concise sentences. Focus on the core idea.\n\nTitle: ${note.title}\n\nContent:\n${note.content}`,
          },
        ],
      });

      const summary = message.content[0].type === "text" ? message.content[0].text : "";
      return { content: [{ type: "text", text: summary }] };
    }
  );

  server.tool(
    "draft_daily_journal",
    "Use AI to draft a daily journal entry based on all notes created or updated today",
    {
      date: z
        .string()
        .optional()
        .describe("ISO date string (YYYY-MM-DD). Defaults to today."),
    },
    async ({ date }) => {
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const allNotes = await listNotes(db, userId, 200, 0);
      const todaysNotes = allNotes.filter((n) => {
        const updated = n.updatedAt ? new Date(n.updatedAt) : null;
        if (!updated) return false;
        return updated >= startOfDay && updated <= endOfDay;
      });

      if (todaysNotes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No notes were created or updated on ${targetDate.toISOString().split("T")[0]}. Nothing to journal about yet!`,
            },
          ],
        };
      }

      const notesSummary = todaysNotes
        .map((n) => `## ${n.title}\nTags: ${n.tags.join(", ") || "none"}\n\n${n.content}`)
        .join("\n\n---\n\n");

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a thoughtful journaling assistant. Based on the following notes captured today (${targetDate.toDateString()}), draft a reflective daily journal entry. Write in first-person, draw connections between ideas, and highlight any key insights or themes.\n\n${notesSummary}`,
          },
        ],
      });

      const journal = message.content[0].type === "text" ? message.content[0].text : "";
      return { content: [{ type: "text", text: journal }] };
    }
  );
}
