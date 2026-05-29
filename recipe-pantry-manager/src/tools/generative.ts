import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '../db/index.js'
import { pantryItems } from '../db/schema.js'

export function registerGenerativeTools(server: McpServer, userId: string) {
  /**
   * Tool 15: suggest_recipe_from_ingredients
   * Generative — uses Claude to invent a recipe from pantry contents
   */
  server.tool(
    'suggest_recipe_from_ingredients',
    'Use AI to suggest a creative recipe based on what is currently in your pantry. Prioritizes ingredients expiring soon. Returns a complete recipe with ingredients and instructions that you can save using create_recipe.',
    {
      cuisine_preference: z.string().optional().describe('Preferred cuisine style (e.g., Italian, Asian, Mexican, Mediterranean, comfort food)'),
      meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'dessert']).optional().describe('Type of meal to suggest'),
      dietary_restrictions: z.string().optional().describe('Dietary restrictions or preferences (e.g., vegetarian, vegan, gluten-free, dairy-free, low-carb)'),
      servings: z.number().int().min(1).max(12).optional().default(4).describe('Number of servings to plan for'),
    },
    async ({ cuisine_preference, meal_type, dietary_restrictions, servings }) => {
      const db = getDb()

      const pantry = await db.select().from(pantryItems).where(eq(pantryItems.userId, userId))

      if (pantry.length === 0) {
        return {
          content: [{ type: 'text', text: 'Your pantry is empty. Add some ingredients first, then I can suggest a recipe.' }],
          isError: true,
        }
      }

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return {
          content: [{ type: 'text', text: 'ANTHROPIC_API_KEY is not configured. Set it in your .env file to use AI recipe suggestions.' }],
          isError: true,
        }
      }

      // Sort: expiring soon first, then by name
      const today = new Date().toISOString().split('T')[0]
      const sorted = [...pantry].sort((a, b) => {
        if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate)
        if (a.expiryDate && !b.expiryDate) return -1
        if (!a.expiryDate && b.expiryDate) return 1
        return a.name.localeCompare(b.name)
      })

      const pantryList = sorted
        .map(item => {
          const expiry = item.expiryDate
            ? item.expiryDate < today
              ? ` [EXPIRED: ${item.expiryDate}]`
              : ` [expires ${item.expiryDate}]`
            : ''
          return `- ${item.name}: ${item.quantity} ${item.unit}${expiry}`
        })
        .join('\n')

      const preferences = [
        cuisine_preference ? `Cuisine: ${cuisine_preference}` : null,
        meal_type ? `Meal type: ${meal_type}` : null,
        dietary_restrictions ? `Dietary restrictions: ${dietary_restrictions}` : null,
        `Servings: ${servings}`,
      ].filter(Boolean).join('\n')

      const prompt = `You are a creative chef helping someone cook with what they have available. Based on the pantry inventory below, suggest one complete, delicious recipe.

PANTRY INVENTORY:
${pantryList}

PREFERENCES:
${preferences}

Rules:
1. Prioritize ingredients marked as expiring soon or expired
2. Only use ingredients from the pantry (you may suggest 1-3 "pantry staples" that weren't listed if they are essential, but mark them with ⚠️)
3. Make the recipe practical and tasty, not just technically possible

Respond with ONLY valid JSON in this exact format:
{
  "name": "Recipe Name",
  "description": "One sentence description of the dish",
  "servings": ${servings},
  "prep_time": 15,
  "cook_time": 30,
  "ingredients": [
    {"name": "ingredient name", "quantity": 2.0, "unit": "cups"}
  ],
  "instructions": "Detailed step-by-step instructions here.",
  "tips": "Optional chef tips",
  "uses_expiring": ["list of expiring ingredients used"]
}`

      try {
        const client = new Anthropic({ apiKey })

        const message = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        })

        const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

        // Extract JSON — handle code blocks and raw JSON
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                          responseText.match(/(\{[\s\S]*\})/)
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText

        let suggestedRecipe: unknown
        try {
          suggestedRecipe = JSON.parse(jsonStr.trim())
        } catch {
          suggestedRecipe = { raw_suggestion: responseText }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              suggested_recipe: suggestedRecipe,
              tip: 'Use create_recipe to save this to your recipe collection!',
            }),
          }],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return {
          content: [{ type: 'text', text: `AI suggestion failed: ${message}` }],
          isError: true,
        }
      }
    }
  )
}
