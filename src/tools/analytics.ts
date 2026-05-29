import { and, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { accounts, transactions } from '../db.js'
import type { DB } from '../db.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleGetMonthlyReport(
  db: DB,
  userId: string,
  params: { month?: string },
): Promise<ToolResult> {
  const targetMonth = params.month ?? new Date().toISOString().slice(0, 7)
  const startDate = `${targetMonth}-01`
  const endDate = `${targetMonth}-31`

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )

  let totalIncomeCents = 0
  let totalExpensesCents = 0
  const byCategoryData: Record<string, { totalCents: number; count: number }> = {}

  for (const t of rows) {
    if (t.type === 'income') {
      totalIncomeCents += t.amount
    } else {
      totalExpensesCents += t.amount
      if (!byCategoryData[t.category]) {
        byCategoryData[t.category] = { totalCents: 0, count: 0 }
      }
      byCategoryData[t.category].totalCents += t.amount
      byCategoryData[t.category].count += 1
    }
  }

  const byCategory = Object.entries(byCategoryData)
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .map(([category, { totalCents, count }]) => ({
      category,
      total: `$${(totalCents / 100).toFixed(2)}`,
      transactionCount: count,
    }))

  const result = {
    month: targetMonth,
    totalIncome: `$${(totalIncomeCents / 100).toFixed(2)}`,
    totalExpenses: `$${(totalExpensesCents / 100).toFixed(2)}`,
    net: `$${((totalIncomeCents - totalExpensesCents) / 100).toFixed(2)}`,
    byCategory,
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

export async function handleGetNetWorth(db: DB, userId: string): Promise<ToolResult> {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId))

  let totalAssetsCents = 0
  let totalLiabilitiesCents = 0

  for (const a of rows) {
    if (a.type === 'credit') {
      totalLiabilitiesCents += a.balance
    } else {
      totalAssetsCents += a.balance
    }
  }

  const result = {
    totalAssets: `$${(totalAssetsCents / 100).toFixed(2)}`,
    totalLiabilities: `$${(totalLiabilitiesCents / 100).toFixed(2)}`,
    netWorth: `$${((totalAssetsCents - totalLiabilitiesCents) / 100).toFixed(2)}`,
    byAccount: rows.map((a) => ({
      name: a.name,
      type: a.type,
      balance: `$${(a.balance / 100).toFixed(2)}`,
      role: a.type === 'credit' ? 'liability' : 'asset',
    })),
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

export function registerAnalyticsTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'get_monthly_report',
    {
      description:
        'Get a full breakdown of income and spending for a given month grouped by category, with totals and a net figure.',
      inputSchema: z.object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe('Month in YYYY-MM format. Defaults to the current month.'),
      }),
    },
    (params) => handleGetMonthlyReport(db, userId, params),
  )

  server.registerTool(
    'get_net_worth',
    {
      description:
        'Calculate your total net worth by summing all account balances. Credit card balances are treated as liabilities.',
      inputSchema: z.object({}),
    },
    () => handleGetNetWorth(db, userId),
  )
}
