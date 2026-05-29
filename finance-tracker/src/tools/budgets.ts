import { and, eq, gte, lte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { budgets, transactions } from '../db.js'
import type { DB } from '../db.js'
import { CATEGORIES } from '../types.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

export async function handleSetBudget(
  db: DB,
  userId: string,
  params: { category: string; monthlyLimit: number },
): Promise<ToolResult> {
  const limitCents = Math.round(params.monthlyLimit * 100)
  const now = Date.now()

  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(budgets)
      .set({ monthlyLimit: limitCents, updatedAt: now })
      .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))
    return {
      content: [{
        type: 'text',
        text: `Budget for ${params.category} updated to $${params.monthlyLimit.toFixed(2)}/month.`,
      }],
    }
  }

  await db.insert(budgets).values({
    id: randomUUID(),
    userId,
    category: params.category,
    monthlyLimit: limitCents,
    createdAt: now,
    updatedAt: now,
  })
  return {
    content: [{
      type: 'text',
      text: `Budget for ${params.category} set to $${params.monthlyLimit.toFixed(2)}/month.`,
    }],
  }
}

export async function handleListBudgets(db: DB, userId: string): Promise<ToolResult> {
  const allBudgets = await db.select().from(budgets).where(eq(budgets.userId, userId))

  if (allBudgets.length === 0) {
    return { content: [{ type: 'text', text: 'No budgets set. Use set_budget to create one.' }] }
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const monthStart = `${year}-${month}-01`
  const monthEnd = `${year}-${month}-31`

  const monthExpenses = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ),
    )

  const spentByCategory: Record<string, number> = {}
  for (const t of monthExpenses) {
    spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount
  }

  const result = allBudgets.map((b) => {
    const spent = spentByCategory[b.category] ?? 0
    const percentUsed = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0
    return {
      category: b.category,
      limit: `$${(b.monthlyLimit / 100).toFixed(2)}`,
      spent: `$${(spent / 100).toFixed(2)}`,
      remaining: `$${((b.monthlyLimit - spent) / 100).toFixed(2)}`,
      percentUsed: `${percentUsed}%`,
      status: percentUsed >= 100 ? 'OVER BUDGET' : percentUsed >= 80 ? 'WARNING' : 'ON TRACK',
    }
  })

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

export async function handleDeleteBudget(
  db: DB,
  userId: string,
  params: { category: string },
): Promise<ToolResult> {
  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))
    .limit(1)

  if (existing.length === 0) {
    return { content: [{ type: 'text', text: `No budget found for ${params.category}.` }] }
  }

  await db
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, params.category)))

  return { content: [{ type: 'text', text: `Budget for ${params.category} deleted.` }] }
}

export function registerBudgetTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'set_budget',
    {
      description:
        'Create or update the monthly spending limit for a category. Calling this again for the same category overwrites the previous limit.',
      inputSchema: z.object({
        category: z.enum(CATEGORIES).describe('The spending category'),
        monthlyLimit: z.number().positive().describe('Monthly spending limit in dollars'),
      }),
    },
    (params) => handleSetBudget(db, userId, params),
  )

  server.registerTool(
    'list_budgets',
    {
      description:
        'List all your budgets with the monthly limit, amount spent so far this month, remaining headroom, and status.',
      inputSchema: z.object({}),
    },
    () => handleListBudgets(db, userId),
  )

  server.registerTool(
    'delete_budget',
    {
      description: 'Remove the monthly budget for a given category.',
      inputSchema: z.object({
        category: z.enum(CATEGORIES).describe('The category to remove the budget for'),
      }),
    },
    (params) => handleDeleteBudget(db, userId, params),
  )
}
