import { and, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { budgets, transactions } from '../db.js'
import type { DB } from '../db.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }> }

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

function pctChange(current: number, previous: number): string {
  if (previous === 0) return 'N/A'
  return `${Math.abs(Math.round(((current - previous) / previous) * 100))}%`
}

export async function handleGenerateFinancialInsights(db: DB, userId: string): Promise<ToolResult> {
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = lastMonthDate.toISOString().slice(0, 7)

  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10)

  const [thisMonthTxns, lastMonthTxns, recentExpenses, allBudgets] = await Promise.all([
    db.select().from(transactions).where(
      and(eq(transactions.userId, userId), gte(transactions.date, `${thisMonth}-01`), lte(transactions.date, `${thisMonth}-31`)),
    ),
    db.select().from(transactions).where(
      and(eq(transactions.userId, userId), gte(transactions.date, `${lastMonth}-01`), lte(transactions.date, `${lastMonth}-31`)),
    ),
    db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, threeMonthsAgoStr),
        lte(transactions.date, `${thisMonth}-31`),
      ),
    ),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
  ])

  // Aggregate this month
  let thisIncome = 0
  let thisExpenses = 0
  const thisMonthByCategory: Record<string, number> = {}
  for (const t of thisMonthTxns) {
    if (t.type === 'income') thisIncome += t.amount
    else {
      thisExpenses += t.amount
      thisMonthByCategory[t.category] = (thisMonthByCategory[t.category] ?? 0) + t.amount
    }
  }

  // Aggregate last month
  let lastExpenses = 0
  const lastMonthByCategory: Record<string, number> = {}
  for (const t of lastMonthTxns) {
    if (t.type !== 'income') {
      lastExpenses += t.amount
      lastMonthByCategory[t.category] = (lastMonthByCategory[t.category] ?? 0) + t.amount
    }
  }

  // 3-month average by category
  const threeMonthTotalByCategory: Record<string, number> = {}
  for (const t of recentExpenses) {
    threeMonthTotalByCategory[t.category] = (threeMonthTotalByCategory[t.category] ?? 0) + t.amount
  }
  const avgByCategory: Record<string, number> = {}
  for (const [cat, total] of Object.entries(threeMonthTotalByCategory)) {
    avgByCategory[cat] = Math.round(total / 3)
  }

  const lines: string[] = []

  // Section 1: Monthly Summary
  lines.push('## Monthly Summary', '')
  lines.push(
    `In **${thisMonth}**, you earned **${fmt(thisIncome)}** and spent **${fmt(thisExpenses)}**, ` +
    `for a net of **${fmt(thisIncome - thisExpenses)}**.`,
  )

  if (lastMonthTxns.length > 0) {
    const direction = thisExpenses > lastExpenses ? 'more' : 'less'
    lines.push(
      `Compared to ${lastMonth}, you spent **${pctChange(thisExpenses, lastExpenses)} ${direction}** overall (${fmt(lastExpenses)} last month).`,
    )

    const allCategories = new Set([...Object.keys(thisMonthByCategory), ...Object.keys(lastMonthByCategory)])
    const notable: string[] = []
    for (const cat of allCategories) {
      const curr = thisMonthByCategory[cat] ?? 0
      const prev = lastMonthByCategory[cat] ?? 0
      if (prev > 0 && Math.abs(curr - prev) / prev > 0.2 && Math.abs(curr - prev) > 1000) {
        const dir = curr > prev ? 'more' : 'less'
        notable.push(`${cat}: ${fmt(curr)} (${pctChange(curr, prev)} ${dir} than last month)`)
      }
    }
    if (notable.length > 0) {
      lines.push('', '**Notable changes:**')
      notable.forEach((n) => lines.push(`- ${n}`))
    }
  } else {
    lines.push('No data from last month to compare.')
  }

  // Section 2: Budget Status
  lines.push('', '## Budget Status', '')
  if (allBudgets.length === 0) {
    lines.push('No budgets set. Use `set_budget` to create one.')
  } else {
    for (const b of allBudgets) {
      const spent = thisMonthByCategory[b.category] ?? 0
      const pctUsed = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0
      const statusIcon = pctUsed >= 100 ? '🔴' : pctUsed >= 80 ? '🟡' : '🟢'
      const statusLabel = pctUsed >= 100 ? 'OVER BUDGET' : pctUsed >= 80 ? 'WARNING' : 'ON TRACK'
      lines.push(
        `- **${b.category}**: ${fmt(spent)} of ${fmt(b.monthlyLimit)} (${pctUsed}%) — ${statusIcon} ${statusLabel}`,
      )
    }
  }

  // Section 3: Budget Recommendations
  lines.push('', '## Budget Recommendations', '')
  if (Object.keys(avgByCategory).length === 0) {
    lines.push('Not enough transaction history to make recommendations. Log more transactions first.')
  } else {
    lines.push('Based on your 3-month average spending:')
    for (const [cat, avg] of Object.entries(avgByCategory).sort((a, b) => b[1] - a[1])) {
      const suggestion = Math.round(avg * 1.1) // 10% buffer
      const existing = allBudgets.find((b) => b.category === cat)
      if (existing) {
        const diff = suggestion - existing.monthlyLimit
        if (Math.abs(diff) > 500) {
          const adj = diff > 0 ? 'increasing' : 'decreasing'
          lines.push(
            `- **${cat}**: Consider ${adj} your budget to ${fmt(suggestion)} (currently ${fmt(existing.monthlyLimit)})`,
          )
        }
      } else {
        lines.push(
          `- **${cat}**: Suggested budget of ${fmt(suggestion)}/month (based on ${fmt(avg)} average spend)`,
        )
      }
    }
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}

export function registerGenerativeTools(server: McpServer, userId: string, db: DB): void {
  server.registerTool(
    'generate_financial_insights',
    {
      description:
        'Generate a plain-English financial summary with three sections: Monthly Summary (this month vs last), Budget Status (all active budgets), and Budget Recommendations (suggested amounts from 3-month averages).',
      inputSchema: z.object({}),
    },
    () => handleGenerateFinancialInsights(db, userId),
  )
}
