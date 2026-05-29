import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { accounts } from '../db.js'
import type { DB } from '../db.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleCreateAccount(
  db: DB,
  userId: string,
  params: { name: string; type: string; openingBalance: number },
): Promise<ToolResult> {
  const account = {
    id: randomUUID(),
    userId,
    name: params.name,
    type: params.type,
    balance: Math.round(params.openingBalance * 100),
    createdAt: Date.now(),
  }
  await db.insert(accounts).values(account)
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...account, balance: `$${(account.balance / 100).toFixed(2)}` }),
    }],
  }
}

export async function handleListAccounts(db: DB, userId: string): Promise<ToolResult> {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId))
  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'No accounts found. Create one with create_account.' }] }
  }
  const formatted = rows.map((a) => ({ ...a, balance: `$${(a.balance / 100).toFixed(2)}` }))
  return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
}

export async function handleUpdateAccountBalance(
  db: DB,
  userId: string,
  params: { accountId: string; balance: number },
): Promise<ToolResult> {
  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return { content: [{ type: 'text', text: 'Account not found.' }] }
  }

  const balanceCents = Math.round(params.balance * 100)
  await db
    .update(accounts)
    .set({ balance: balanceCents })
    .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, userId)))

  const updated = { ...existing[0], balance: `$${(balanceCents / 100).toFixed(2)}` }
  return { content: [{ type: 'text', text: JSON.stringify(updated) }] }
}

export function registerAccountTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'create_account',
    {
      description: 'Create a new financial account (checking, savings, credit, cash, or investment) with an opening balance.',
      inputSchema: z.object({
        name: z.string().describe('Account name, e.g. "Chase Checking"'),
        type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment']).describe('Account type'),
        openingBalance: z.number().default(0).describe('Opening balance in dollars, e.g. 1000.50'),
      }),
    },
    (params) => handleCreateAccount(db, userId, params),
  )

  server.registerTool(
    'list_accounts',
    {
      description: 'List all your financial accounts with their current balances.',
      inputSchema: z.object({}),
    },
    () => handleListAccounts(db, userId),
  )

  server.registerTool(
    'update_account_balance',
    {
      description: "Manually set an account's balance in dollars. Useful for corrections or initial sync.",
      inputSchema: z.object({
        accountId: z.string().describe('The account ID to update'),
        balance: z.number().describe('New balance in dollars'),
      }),
    },
    (params) => handleUpdateAccountBalance(db, userId, params),
  )
}
