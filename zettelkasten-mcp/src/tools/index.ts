import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNoteTools } from "./notes.js";
import { registerLinkTools } from "./links.js";
import { registerSearchTools } from "./search.js";
import { registerGraphTools } from "./graph.js";
import { registerGenerativeTools } from "./generative.js";

export function registerAllTools(server: McpServer, userId: string): void {
  registerNoteTools(server, userId);
  registerLinkTools(server, userId);
  registerSearchTools(server, userId);
  registerGraphTools(server, userId);
  registerGenerativeTools(server, userId);
}
