import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers.js'
import { handleCreateAccount } from '../tools/accounts.js'
import { handleAddTransaction } from '../tools/transactions.js'
import { handleGetMonthlyReport, handleGetNetWorth } from '../tools/analytics.js'

const USER_A = 'user-a'

describe('analytics tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleGetMonthlyReport', () => {
    it('returns totals and breakdown by category', async () => {
      await handleAddTransaction(db, USER_A, { amount: 2000, type: 'income', category: 'Income', description: 'Salary', date: '2026-05-01' })
      await handleAddTransaction(db, USER_A, { amount: 300, type: 'expense', category: 'Food', description: 'Groceries', date: '2026-05-10' })
      await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'Dining', date: '2026-05-15' })
      await handleAddTransaction(db, USER_A, { amount: 50, type: 'expense', category: 'Transport', description: 'Bus', date: '2026-05-20' })

      const result = await handleGetMonthlyReport(db, USER_A, { month: '2026-05' })
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.month).toBe('2026-05')
      expect(parsed.totalIncome).toBe('$2000.00')
      expect(parsed.totalExpenses).toBe('$450.00')
      expect(parsed.net).toBe('$1550.00')
      expect(parsed.byCategory).toHaveLength(2)

      const food = parsed.byCategory.find((c: { category: string }) => c.category === 'Food')
      expect(food.total).toBe('$400.00')
      expect(food.transactionCount).toBe(2)
    })

    it('excludes transactions from other months', async () => {
      await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'April', date: '2026-04-15' })
      await handleAddTransaction(db, USER_A, { amount: 200, type: 'expense', category: 'Food', description: 'May', date: '2026-05-15' })

      const result = await handleGetMonthlyReport(db, USER_A, { month: '2026-05' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.totalExpenses).toBe('$200.00')
    })

    it("excludes other users' transactions", async () => {
      await handleAddTransaction(db, 'user-b', { amount: 500, type: 'expense', category: 'Food', description: 'B', date: '2026-05-01' })
      await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'A', date: '2026-05-01' })

      const result = await handleGetMonthlyReport(db, USER_A, { month: '2026-05' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.totalExpenses).toBe('$100.00')
    })
  })

  describe('handleGetNetWorth', () => {
    it('sums assets and treats credit as liabilities', async () => {
      await handleCreateAccount(db, USER_A, { name: 'Checking', type: 'checking', openingBalance: 5000 })
      await handleCreateAccount(db, USER_A, { name: 'Savings', type: 'savings', openingBalance: 10000 })
      await handleCreateAccount(db, USER_A, { name: 'Credit Card', type: 'credit', openingBalance: 2000 })

      const result = await handleGetNetWorth(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.totalAssets).toBe('$15000.00')
      expect(parsed.totalLiabilities).toBe('$2000.00')
      expect(parsed.netWorth).toBe('$13000.00')
      expect(parsed.byAccount).toHaveLength(3)
    })

    it('returns zero net worth for user with no accounts', async () => {
      const result = await handleGetNetWorth(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.netWorth).toBe('$0.00')
    })
  })
})
