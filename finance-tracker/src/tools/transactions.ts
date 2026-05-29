import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { accounts, transactions } from '../db.js'
import type { DB } from '../db.js'
import { CATEGORIES } from '../types.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleAddTransaction(
  db: DB,
  userId: string,
  params: {
    amount: number
    type: string
    category: string
    description: string
    date: string
    accountId?: string
  },
): Promise<ToolResult> {
  const amountCents = Math.round(params.amount * 100)

  if (params.accountId) {
    const acct = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, userId)))
      .limit(1)

    if (acct.length === 0) {
      return { content: [{ type: 'text', text: 'Account not found.' }] }
    }

    const delta = params.type === 'income' ? amountCents : -amountCents
    await db
      .update(accounts)
      .set({ balance: acct[0].balance + delta })
      .where(eq(accounts.id, params.accountId))
  }

  const tx = {
    id: randomUUID(),
    userId,
    accountId: params.accountId ?? null,
    amount: amountCents,
    type: params.type,
    category: params.category,
    description: params.description,
    date: params.date,
    createdAt: Date.now(),
  }
  await db.insert(transactions).values(tx)

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ ...tx, amount: `$${(amountCents / 100).toFixed(2)}` }),
    }],
  }
}

export async function handleListTransactions(
  db: DB,
  userId: string,
  params: {
    accountId?: string
    category?: string
    type?: string
    startDate?: string
    endDate?: string
    limit?: number
  },
): Promise<ToolResult> {
  const conditions = [eq(transactions.userId, userId)]
  if (params.accountId) conditions.push(eq(transactions.accountId, params.accountId))
  if (params.category) conditions.push(eq(transactions.category, params.category))
  if (params.type) conditions.push(eq(transactions.type, params.type))
  if (params.startDate) conditions.push(gte(transactions.date, params.startDate))
  if (params.endDate) conditions.push(lte(transactions.date, params.endDate))

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(params.limit ?? 50)

  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'No transactions found.' }] }
  }

  const formatted = rows.map((t) => ({ ...t, amount: `$${(t.amount / 100).toFixed(2)}` }))
  return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
}

export async function handleGetTransaction(
  db: DB,
  userId: string,
  params: { transactionId: string },
): Promise<ToolResult> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))
    .limit(1)

  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'Transaction not found.' }] }
  }

  const t = rows[0]
  return {
    content: [{ type: 'text', text: JSON.stringify({ ...t, amount: `$${(t.amount / 100).toFixed(2)}` }) }],
  }
}

export async function handleDeleteTransaction(
  db: DB,
  userId: string,
  params: { transactionId: string },
): Promise<ToolResult> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))
    .limit(1)

  if (rows.length === 0) {
    return { content: [{ type: 'text', text: 'Transaction not found.' }] }
  }

  const tx = rows[0]

  if (tx.accountId) {
    const acct = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, tx.accountId), eq(accounts.userId, userId)))
      .limit(1)

    if (acct.length > 0) {
      const reverseDelta = tx.type === 'income' ? -tx.amount : tx.amount
      await db
        .update(accounts)
        .set({ balance: acct[0].balance + reverseDelta })
        .where(eq(accounts.id, tx.accountId))
    }
  }

  await db
    .delete(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))

  return { content: [{ type: 'text', text: `Transaction ${params.transactionId} deleted.` }] }
}

export function registerTransactionTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'add_transaction',
    {
      description:
        "Log an income or expense transaction. Optionally link it to an account to update that account's balance.",
      inputSchema: z.object({
        amount: z.number().positive().describe('Transaction amount in dollars, e.g. 45.99'),
        type: z.enum(['income', 'expense']).describe('Whether this is income or an expense'),
        category: z.enum(CATEGORIES).describe('Spending category'),
        description: z.string().describe('Description of the transaction'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD format'),
        accountId: z.string().optional().describe('Optional account ID to link this transaction to'),
      }),
    },
    (params) => handleAddTransaction(db, userId, params),
  )

  server.registerTool(
    'list_transactions',
    {
      description: 'List transactions with optional filters by account, category, type, and/or date range.',
      inputSchema: z.object({
        accountId: z.string().optional().describe('Filter by account ID'),
        category: z.enum(CATEGORIES).optional().describe('Filter by category'),
        type: z.enum(['income', 'expense']).optional().describe('Filter by transaction type'),
        startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
        endDate: z.string().optional().describe('End date YYYY-MM-DD'),
        limit: z.number().int().min(1).max(500).default(50).describe('Max results (default 50)'),
      }),
    },
    (params) => handleListTransactions(db, userId, params),
  )

  server.registerTool(
    'get_transaction',
    {
      description: 'Fetch a single transaction by its ID.',
      inputSchema: z.object({
        transactionId: z.string().describe('The transaction ID'),
      }),
    },
    (params) => handleGetTransaction(db, userId, params),
  )

  server.registerTool(
    'delete_transaction',
    {
      description:
        'Delete a transaction. If it was linked to an account, the account balance is reversed.',
      inputSchema: z.object({
        transactionId: z.string().describe('The transaction ID to delete'),
      }),
    },
    (params) => handleDeleteTransaction(db, userId, params),
  )
}
