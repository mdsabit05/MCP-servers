import { McpServer } from '@modelcontextprotocol/server'
import type { DB } from './db.js'
import { registerAccountTools } from './tools/accounts.js'
import { registerAnalyticsTools } from './tools/analytics.js'
import { registerBudgetTools } from './tools/budgets.js'
import { registerGenerativeTools } from './tools/generative.js'
import { registerTransactionTools } from './tools/transactions.js'

export function createMcpServer(userId: string, db: DB): McpServer {
  const server = new McpServer({
    name: 'finance-mcp',
    version: '1.0.0',
  })

  registerAccountTools(server, userId, db)
  registerTransactionTools(server, userId, db)
  registerBudgetTools(server, userId, db)
  registerAnalyticsTools(server, userId, db)
  registerGenerativeTools(server, userId, db)

  return server
}
