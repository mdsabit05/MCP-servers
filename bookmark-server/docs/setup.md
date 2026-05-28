# Bookmark MCP Server — Setup & Integration Guide

## Prerequisites

- Node.js 22+
- A GitHub account (for OAuth)
- An Anthropic API key (for `suggest_next_read`)
- Claude Code or Claude Desktop as your MCP client

---

## 1. Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Fill in:
   | Field | Value |
   |---|---|
   | Application name | `Bookmark MCP Server (local)` |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `https://mcpproject2-be-tn.groo.bot/api/auth/callback/github` |
3. Click **Register application**
4. On the next screen, click **Generate a new client secret**
5. Copy the **Client ID** and **Client Secret** — you'll need them in the next step

---

## 2. Configure Environment

```bash
cd bookmark-server
cp .env.example .env
```

Edit `.env`:

```env
GITHUB_CLIENT_ID=<your client id>
GITHUB_CLIENT_SECRET=<your client secret>
BETTER_AUTH_SECRET=<run: openssl rand -hex 32>
ANTHROPIC_API_KEY=<your anthropic key>
PORT=54786
BASE_URL=https://mcpproject2-be-tn.groo.bot
```

Generate a strong secret:

```bash
openssl rand -hex 32
```

---

## 3. Start the Server

```bash
npm run dev
```

Expected output:

```
Bookmark MCP Server running on http://localhost:3000
  Auth:   http://localhost:3000/api/auth/sign-in/social?provider=github
  MCP:    http://localhost:3000/mcp
  Health: http://localhost:3000/health
```

---

## 4. Sign In and Get Your Session Token

1. **Open this URL in your browser:**

   ```
   https://mcpproject2-be-tn.groo.bot/api/auth/sign-in/social?provider=github
   ```

2. Authorize the GitHub OAuth app when prompted.

3. After the redirect completes, **open your browser's DevTools → Application → Cookies → localhost:3000**.

4. Copy the value of the cookie named `better-auth.session_token`.

   > This is your bearer token. Keep it secret — it grants full access to your bookmarks.

Alternatively, fetch it via curl after the browser login sets the cookie:

```bash
# Replace <cookie-value> with the better-auth.session_token cookie from DevTools
curl -s http://localhost:3000/api/auth/get-session \
  -H "Cookie: better-auth.session_token=<cookie-value>" \
  | python3 -m json.tool
```

The `session.token` field in the response is your bearer token.

---

## 5. Connect Claude Code

Edit `~/.claude.json` or add an MCP server entry via `claude mcp add`:

```bash
claude mcp add bookmark-server \
  --transport http \
  --url https://mcpproject2-be-tn.groo.bot/mcp \
  --header "Authorization: Bearer YOUR_SESSION_TOKEN"
```

Or add it manually to `~/.claude.json`:

```json
{
  "mcpServers": {
    "bookmark-server": {
      "type": "http",
      "url": "https://mcpproject2-be-tn.groo.bot/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SESSION_TOKEN_HERE"
      }
    }
  }
}
```

**For Claude Desktop**, add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "bookmark-server": {
      "type": "http",
      "url": "https://mcpproject2-be-tn.groo.bot/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SESSION_TOKEN_HERE"
      }
    }
  }
}
```

---

## 6. Verify — All 15 Tools Visible

In Claude Code, run `/mcp` and confirm you see:

| # | Tool | What it does |
|---|---|---|
| 1 | `save_bookmark` | Save a URL |
| 2 | `get_bookmark` | Get one bookmark by ID |
| 3 | `list_bookmarks` | List with optional read-status filter |
| 4 | `update_bookmark` | Update title, description, read status, progress |
| 5 | `delete_bookmark` | Permanently delete a bookmark |
| 6 | `fetch_bookmark_content` | Fetch URL, extract text/title/favicon |
| 7 | `add_tags` | Tag a bookmark (auto-creates tags) |
| 8 | `remove_tags` | Remove tags from a bookmark |
| 9 | `list_tags` | List all your tags |
| 10 | `add_highlight` | Save a quoted passage with a note |
| 11 | `get_highlights` | Get all highlights for a bookmark |
| 12 | `export_highlights` | Export highlights as Markdown |
| 13 | `search_bookmarks` | Full-text search across title/content/URL |
| 14 | `get_reading_stats` | Aggregate stats (read count, reading time, by month) |
| 15 | `suggest_next_read` | AI-powered next-read suggestion (calls Claude Haiku) |

---

## 7. End-to-End Smoke Test

Ask Claude:

> "Save https://modelcontextprotocol.io as a bookmark titled 'MCP Docs', fetch its content, add tags 'mcp' and 'docs', then suggest my next read."

Expected tool call sequence: `save_bookmark` → `fetch_bookmark_content` → `add_tags` → `suggest_next_read`

---

## Per-User Data Isolation

Every tool call is authenticated via the `Authorization: Bearer` header. The server validates the session with better-auth before any DB query runs. All queries are filtered by `user_id`, so **user A can never read or modify user B's data** — enforced at the query level, not just the HTTP level.

---

## Running Tests

```bash
npm test
```

28 tests across 8 suites. All DB tests use in-memory SQLite — no network or real DB needed. The fetcher suite makes one real request to `example.com`; skip it offline with `npm test -- --exclude tests/utils/fetcher.test.ts`.
