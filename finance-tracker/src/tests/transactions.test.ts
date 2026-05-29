import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { accounts, transactions } from '../db.js'
import { handleCreateAccount } from '../tools/accounts.js'
import {
  handleAddTransaction,
  handleListTransactions,
  handleGetTransaction,
  handleDeleteTransaction,
} from '../tools/transactions.js'

const USER_A = 'user-a'
const USER_B = 'user-b'

async function seedAccount(db: ReturnType<typeof createTestDb>, userId: string, balance = 1000) {
  const result = await handleCreateAccount(db, userId, {
    name: 'Checking',
    type: 'checking',
    openingBalance: balance,
  })
  return JSON.parse(result.content[0].text).id as string
}

describe('transaction tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleAddTransaction', () => {
    it('creates an expense transaction', async () => {
      const result = await handleAddTransaction(db, USER_A, {
        amount: 45.99,
        type: 'expense',
        category: 'Food',
        description: 'Groceries',
        date: '2026-05-15',
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.amount).toBe('$45.99')
      expect(parsed.category).toBe('Food')
      expect(parsed.type).toBe('expense')
    })

    it('decrements account balance for linked expense', async () => {
      const accountId = await seedAccount(db, USER_A, 500)

      await handleAddTransaction(db, USER_A, {
        amount: 100,
        type: 'expense',
        category: 'Shopping',
        description: 'Clothes',
        date: '2026-05-01',
        accountId,
      })

      const rows = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(rows[0].balance).toBe(40000) // $500 - $100 = $400 in cents
    })

    it('increments account balance for linked income', async () => {
      const accountId = await seedAccount(db, USER_A, 500)

      await handleAddTransaction(db, USER_A, {
        amount: 200,
        type: 'income',
        category: 'Income',
        description: 'Salary',
        date: '2026-05-01',
        accountId,
      })

      const rows = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(rows[0].balance).toBe(70000) // $700 in cents
    })

    it('returns error for accountId not owned by user', async () => {
      const accountId = await seedAccount(db, USER_B, 500)

      const result = await handleAddTransaction(db, USER_A, {
        amount: 50,
        type: 'expense',
        category: 'Food',
        description: 'Lunch',
        date: '2026-05-01',
        accountId,
      })
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('handleListTransactions', () => {
    it('returns only the requesting user\'s transactions', async () => {
      await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'A', date: '2026-05-01' })
      await handleAddTransaction(db, USER_B, { amount: 20, type: 'expense', category: 'Food', description: 'B', date: '2026-05-01' })

      const result = await handleListTransactions(db, USER_A, {})
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].description).toBe('A')
    })

    it('filters by category', async () => {
      await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'Lunch', date: '2026-05-01' })
      await handleAddTransaction(db, USER_A, { amount: 50, type: 'expense', category: 'Transport', description: 'Bus', date: '2026-05-02' })

      const result = await handleListTransactions(db, USER_A, { category: 'Food' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].description).toBe('Lunch')
    })

    it('filters by date range', async () => {
      await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'Jan', date: '2026-01-15' })
      await handleAddTransaction(db, USER_A, { amount: 20, type: 'expense', category: 'Food', description: 'May', date: '2026-05-10' })

      const result = await handleListTransactions(db, USER_A, { startDate: '2026-05-01', endDate: '2026-05-31' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].description).toBe('May')
    })
  })

  describe('handleGetTransaction', () => {
    it('returns transaction by id', async () => {
      const added = await handleAddTransaction(db, USER_A, { amount: 99, type: 'expense', category: 'Health', description: 'Doctor', date: '2026-05-01' })
      const id = JSON.parse(added.content[0].text).id

      const result = await handleGetTransaction(db, USER_A, { transactionId: id })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.description).toBe('Doctor')
    })

    it('returns error for transaction owned by another user', async () => {
      const added = await handleAddTransaction(db, USER_B, { amount: 99, type: 'expense', category: 'Health', description: 'Doctor', date: '2026-05-01' })
      const id = JSON.parse(added.content[0].text).id

      const result = await handleGetTransaction(db, USER_A, { transactionId: id })
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('handleDeleteTransaction', () => {
    it('deletes the transaction', async () => {
      const added = await handleAddTransaction(db, USER_A, { amount: 10, type: 'expense', category: 'Food', description: 'Snack', date: '2026-05-01' })
      const id = JSON.parse(added.content[0].text).id

      await handleDeleteTransaction(db, USER_A, { transactionId: id })

      const rows = await db.select().from(transactions).where(eq(transactions.id, id))
      expect(rows).toHaveLength(0)
    })

    it('reverses account balance on deletion of linked expense', async () => {
      const accountId = await seedAccount(db, USER_A, 500)
      const added = await handleAddTransaction(db, USER_A, { amount: 100, type: 'expense', category: 'Food', description: 'Dinner', date: '2026-05-01', accountId })
      const id = JSON.parse(added.content[0].text).id

      // After adding $100 expense: balance = $400
      const before = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(before[0].balance).toBe(40000)

      await handleDeleteTransaction(db, USER_A, { transactionId: id })

      // After reversal: balance = $500 again
      const after = await db.select().from(accounts).where(eq(accounts.id, accountId))
      expect(after[0].balance).toBe(50000)
    })
  })
})
