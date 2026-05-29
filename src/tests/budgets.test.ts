import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers.js'
import { handleAddTransaction } from '../tools/transactions.js'
import {
  handleSetBudget,
  handleListBudgets,
  handleDeleteBudget,
} from '../tools/budgets.js'

const USER_A = 'user-a'

describe('budget tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleSetBudget', () => {
    it('creates a new budget', async () => {
      const result = await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 300 })
      expect(result.content[0].text).toContain('Food')
      expect(result.content[0].text).toContain('$300.00')
    })

    it('updates an existing budget (upsert)', async () => {
      await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 300 })
      const result = await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 400 })
      expect(result.content[0].text).toContain('updated')
      expect(result.content[0].text).toContain('$400.00')
    })
  })

  describe('handleListBudgets', () => {
    it('shows current month spending vs limit', async () => {
      await handleSetBudget(db, USER_A, { category: 'Food', monthlyLimit: 500 })

      const today = new Date().toISOString().slice(0, 10)
      await handleAddTransaction(db, USER_A, {
        amount: 150,
        type: 'expense',
        category: 'Food',
        description: 'Groceries',
        date: today,
      })

      const result = await handleListBudgets(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].category).toBe('Food')
      expect(parsed[0].spent).toBe('$150.00')
      expect(parsed[0].remaining).toBe('$350.00')
      expect(parsed[0].status).toBe('ON TRACK')
    })

    it('marks as OVER BUDGET when spending exceeds limit', async () => {
      await handleSetBudget(db, USER_A, { category: 'Shopping', monthlyLimit: 100 })
      const today = new Date().toISOString().slice(0, 10)
      await handleAddTransaction(db, USER_A, { amount: 150, type: 'expense', category: 'Shopping', description: 'Clothes', date: today })

      const result = await handleListBudgets(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed[0].status).toBe('OVER BUDGET')
    })

    it('returns message when no budgets', async () => {
      const result = await handleListBudgets(db, USER_A)
      expect(result.content[0].text).toContain('No budgets set')
    })
  })

  describe('handleDeleteBudget', () => {
    it('deletes an existing budget', async () => {
      await handleSetBudget(db, USER_A, { category: 'Transport', monthlyLimit: 200 })
      await handleDeleteBudget(db, USER_A, { category: 'Transport' })

      const list = await handleListBudgets(db, USER_A)
      expect(list.content[0].text).toContain('No budgets set')
    })

    it('returns error for non-existent budget', async () => {
      const result = await handleDeleteBudget(db, USER_A, { category: 'Housing' })
      expect(result.content[0].text).toContain('No budget found')
    })
  })
})
