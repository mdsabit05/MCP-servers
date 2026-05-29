import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerRecipeTools } from './recipes.js'
import { registerPantryTools } from './pantry.js'
import { registerMealPlanTools } from './meal-plans.js'
import { registerComputedTools } from './computed.js'
import { registerGenerativeTools } from './generative.js'

/**
 * Create a fully-configured McpServer instance with all tools bound
 * to the given authenticated userId. All tools enforce per-user data isolation.
 */
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'Recipe & Pantry Manager',
    version: '1.0.0',
  })

  registerRecipeTools(server, userId)       // Tools 1-4:  CRUD for recipes
  registerPantryTools(server, userId)       // Tools 5-9:  CRUD for pantry + expiry check
  registerMealPlanTools(server, userId)     // Tools 10-12: Meal planning
  registerComputedTools(server, userId)     // Tools 13-14: what_can_i_cook + shopping list
  registerGenerativeTools(server, userId)   // Tool 15:   AI recipe suggestion

  return server
}
