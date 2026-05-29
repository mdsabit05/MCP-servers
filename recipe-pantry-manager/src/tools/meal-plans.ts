import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { mealPlans, recipes } from '../db/schema.js'

function makeId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

export function registerMealPlanTools(server: McpServer, userId: string) {
  /**
   * Tool 10: get_meal_plan
   * Read — view planned meals for a date range
   */
  server.tool(
    'get_meal_plan',
    'View the meal plan for a date range. Shows which recipes are scheduled for each meal of each day.',
    {
      start_date: z.string().describe('Start of range in YYYY-MM-DD format'),
      end_date: z.string().describe('End of range in YYYY-MM-DD format'),
    },
    async ({ start_date, end_date }) => {
      const db = getDb()
      const rows = await db
        .select({
          id: mealPlans.id,
          date: mealPlans.date,
          mealType: mealPlans.mealType,
          servings: mealPlans.servings,
          notes: mealPlans.notes,
          recipeId: mealPlans.recipeId,
          recipeName: recipes.name,
          recipePrepTime: recipes.prepTime,
          recipeCookTime: recipes.cookTime,
          recipeServings: recipes.servings,
        })
        .from(mealPlans)
        .innerJoin(recipes, eq(mealPlans.recipeId, recipes.id))
        .where(and(
          eq(mealPlans.userId, userId),
          gte(mealPlans.date, start_date),
          lte(mealPlans.date, end_date)
        ))

      // Group by date for a calendar-style view
      const byDate: Record<string, typeof rows> = {}
      for (const row of rows) {
        if (!byDate[row.date]) byDate[row.date] = []
        byDate[row.date].push(row)
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ meal_plan: byDate, total_meals: rows.length }),
        }],
      }
    }
  )

  /**
   * Tool 11: add_meal_plan_entry
   * Write — schedule a recipe for a specific meal
   */
  server.tool(
    'add_meal_plan_entry',
    'Schedule a recipe for a specific meal (breakfast, lunch, dinner, or snack) on a given date.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).describe('Which meal of the day'),
      recipe_id: z.string().describe('ID of the recipe to schedule (use list_recipes to find it)'),
      servings: z.number().int().min(1).optional().default(2).describe('How many servings to make'),
      notes: z.string().optional().describe('Any notes for this meal (e.g., "double the sauce")'),
    },
    async ({ date, meal_type, recipe_id, servings, notes }) => {
      const db = getDb()

      // Security: verify recipe belongs to this user
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, recipe_id), eq(recipes.userId, userId)))

      if (!recipe) {
        return {
          content: [{ type: 'text', text: 'Recipe not found or you do not have access to it.' }],
          isError: true,
        }
      }

      const id = makeId()
      await db.insert(mealPlans).values({
        id,
        userId,
        date,
        mealType: meal_type,
        recipeId: recipe_id,
        servings,
        notes,
        createdAt: new Date(),
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Meal scheduled',
            id,
            date,
            meal_type,
            recipe: recipe.name,
            servings,
          }),
        }],
      }
    }
  )

  /**
   * Tool 12: remove_meal_plan_entry
   * Write — remove a scheduled meal
   */
  server.tool(
    'remove_meal_plan_entry',
    'Remove a scheduled meal from the meal plan by its entry ID. Use get_meal_plan to find entry IDs.',
    {
      entry_id: z.string().describe('The ID of the meal plan entry to remove'),
    },
    async ({ entry_id }) => {
      const db = getDb()
      const [entry] = await db
        .select()
        .from(mealPlans)
        .where(and(eq(mealPlans.id, entry_id), eq(mealPlans.userId, userId)))

      if (!entry) {
        return {
          content: [{ type: 'text', text: 'Meal plan entry not found or you do not have access to it.' }],
          isError: true,
        }
      }

      await db.delete(mealPlans).where(eq(mealPlans.id, entry_id))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Meal plan entry removed',
            date: entry.date,
            meal_type: entry.mealType,
          }),
        }],
      }
    }
  )
}
