import Database from 'better-sqlite3'
import { initDb } from './db/index.js'
import { createApp } from './server.js'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`

function checkAuthTables() {
  const dbPath = process.env.DATABASE_PATH || './data.db'
  const db = new Database(dbPath, { readonly: true })
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name as string)
    return tables.includes('user') && tables.includes('oauthApplication')
  } finally {
    db.close()
  }
}

async function start() {
  // 1. Initialize app tables (recipes, pantry_items, meal_plans)
  initDb()

  // 2. Verify better-auth tables exist
  if (!checkAuthTables()) {
    console.error('\n❌ Auth database tables are missing.')
    console.error('   Run this command first, then restart:\n')
    console.error('   npm run db:migrate\n')
    process.exit(1)
  }

  // 3. Start the server
  const app = createApp()
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('')
    console.log('╔═══════════════════════════════════════════════╗')
    console.log('║      Recipe & Pantry Manager — MCP Server     ║')
    console.log('╠═══════════════════════════════════════════════╣')
    console.log(`║  Server:   ${BASE_URL.padEnd(35)}║`)
    console.log(`║  MCP:      ${(BASE_URL + '/mcp').padEnd(35)}║`)
    console.log(`║  Auth:     ${(BASE_URL + '/api/auth').padEnd(35)}║`)
    console.log(`║  Register: ${(BASE_URL + '/register').padEnd(35)}║`)
    console.log('╚═══════════════════════════════════════════════╝')
    console.log('')
    console.log('Add to Claude Code (~/.claude.json):')
    console.log(JSON.stringify({
      mcpServers: {
        'recipe-pantry': {
          type: 'http',
          url: `${BASE_URL}/mcp`,
        },
      },
    }, null, 2))
    console.log('')
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`)
      console.error(`   Kill the process using it, or change PORT in .env\n`)
      process.exit(1)
    }
    throw err
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
