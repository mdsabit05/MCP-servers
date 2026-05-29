export const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Health',
  'Shopping',
  'Income',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type TransactionType = 'income' | 'expense'

export type HonoEnv = {
  Variables: {
    userId: string
  }
}
