import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers.js'
import { handleAddTransaction } from '../tools/transactions.js'
import { handleSetBudget } from '../tools/budgets.js'
import { handleGenerateFinancialInsights } from '../tools/generative.js'

const USER_A = 'user-a'

describe('handleGenerateFinancialInsights', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it('returns all three sections', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await handleAddTransaction(db, USER_A, { amount: 3000, type: 'income', category: 'Income', description: 'Salary', date: today })
    await handleAddTransaction(db, USER_A, { amount: 200, type: 'expense', category: 'Food', description: 'Groceries', date: today })
    await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 300 })

    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text

    expect(text).toContain('## Monthly Summary')
    expect(text).toContain('## Budget Status')
    expect(text).toContain('## Budget Recommendations')
  })

  it('shows over budget status when spending exceeds limit', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await handleAddTransaction(db, USER_A, { amount: 500, type: 'expense', category: 'Shopping', description: 'Clothes', date: today })
    await handleSetBudget(db, USER_A, { category: 'Shopping', monthlyLimit: 100 })

    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text
    expect(text).toContain('OVER BUDGET')
  })

  it('returns graceful message with no transaction history', async () => {
    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text
    expect(text).toContain('## Monthly Summary')
    expect(text).toContain('## Budget Recommendations')
  })

  it('includes budget suggestion based on spending history', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    await handleAddTransaction(db, USER_A, { amount: 300, type: 'expense', category: 'Food', description: 'Food1', date: today })
    await handleAddTransaction(db, USER_A, { amount: 280, type: 'expense', category: 'Food', description: 'Food2', date: lastMonth.toISOString().slice(0, 10) })
    await handleAddTransaction(db, USER_A, { amount: 320, type: 'expense', category: 'Food', description: 'Food3', date: twoMonthsAgo.toISOString().slice(0, 10) })

    const result = await handleGenerateFinancialInsights(db, USER_A)
    const text = result.content[0].text
    expect(text).toContain('Food')
    expect(text).toContain('Suggested budget')
  })
})
