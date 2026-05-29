import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { accounts } from '../db.js'
import {
  handleCreateAccount,
  handleListAccounts,
  handleUpdateAccountBalance,
} from '../tools/accounts.js'

const USER_A = 'user-a'
const USER_B = 'user-b'

describe('account tools', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  describe('handleCreateAccount', () => {
    it('creates an account and returns it', async () => {
      const result = await handleCreateAccount(db, USER_A, {
        name: 'Chase Checking',
        type: 'checking',
        openingBalance: 1000.50,
      })
      const text = result.content[0].text
      const parsed = JSON.parse(text)
      expect(parsed.name).toBe('Chase Checking')
      expect(parsed.type).toBe('checking')
      expect(parsed.balance).toBe('$1000.50')
    })

    it('stores balance as cents internally', async () => {
      await handleCreateAccount(db, USER_A, {
        name: 'Savings',
        type: 'savings',
        openingBalance: 500.99,
      })
      const rows = await db.select().from(accounts).where(eq(accounts.userId, USER_A))
      expect(rows[0].balance).toBe(50099)
    })
  })

  describe('handleListAccounts', () => {
    it('returns only the requesting user\'s accounts', async () => {
      await handleCreateAccount(db, USER_A, { name: 'A Account', type: 'checking', openingBalance: 0 })
      await handleCreateAccount(db, USER_B, { name: 'B Account', type: 'savings', openingBalance: 0 })

      const result = await handleListAccounts(db, USER_A)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('A Account')
    })

    it('returns message when no accounts', async () => {
      const result = await handleListAccounts(db, USER_A)
      expect(result.content[0].text).toContain('No accounts found')
    })
  })

  describe('handleUpdateAccountBalance', () => {
    it('updates balance to new value in cents', async () => {
      const created = await handleCreateAccount(db, USER_A, {
        name: 'Checking',
        type: 'checking',
        openingBalance: 100,
      })
      const accountId = JSON.parse(created.content[0].text).id

      const result = await handleUpdateAccountBalance(db, USER_A, {
        accountId,
        balance: 250.75,
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.balance).toBe('$250.75')
    })

    it('returns error for account not owned by user', async () => {
      const created = await handleCreateAccount(db, USER_B, {
        name: 'B Account',
        type: 'checking',
        openingBalance: 0,
      })
      const accountId = JSON.parse(created.content[0].text).id

      const result = await handleUpdateAccountBalance(db, USER_A, {
        accountId,
        balance: 999,
      })
      expect(result.content[0].text).toContain('not found')
    })
  })
})
