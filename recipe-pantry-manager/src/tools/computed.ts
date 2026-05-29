import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { recipes, recipeIngredients, pantryItems, mealPlans } from '../db/schema.js'

export function registerComputedTools(server: McpServer, userId: string) {
  /**
   * Tool 13: what_can_i_cook
   * Aggregate — compares pantry against all recipes to find what's cookable
   */
  server.tool(
    'what_can_i_cook',
    'Analyze your pantry and find which of your recipes you can cook right now, which ones need just a few items, and which are not currently possible. Great for answering "what should I make for dinner tonight?"',
    {},
    async () => {
      const db = getDb()

      // Fetch all user data in parallel
      const [allRecipes, allIngredients, pantry] = await Promise.all([
        db.select().from(recipes).where(eq(recipes.userId, userId)),
        db.select().from(recipeIngredients).where(
          sql`${recipeIngredients.recipeId} IN (SELECT id FROM recipes WHERE user_id = ${userId})`
        ),
        db.select().from(pantryItems).where(eq(pantryItems.userId, userId)),
      ])

      // Build pantry lookup: "name::unit" -> quantity
      const pantryByKey: Record<string, number> = {}
      // Also build by name only for cross-unit detection
      const pantryByName: Record<string, Array<{ quantity: number; unit: string }>> = {}
      for (const item of pantry) {
        const key = `${item.name.toLowerCase()}::${item.unit}`
        pantryByKey[key] = (pantryByKey[key] ?? 0) + item.quantity
        const nameKey = item.name.toLowerCase()
        if (!pantryByName[nameKey]) pantryByName[nameKey] = []
        pantryByName[nameKey].push({ quantity: item.quantity, unit: item.unit })
      }

      const canCook: object[] = []
      const almostCook: object[] = []
      const cannotCook: object[] = []

      for (const recipe of allRecipes) {
        const ingredients = allIngredients.filter(i => i.recipeId === recipe.id)

        if (ingredients.length === 0) {
          canCook.push({ id: recipe.id, name: recipe.name, servings: recipe.servings, note: 'No ingredients listed' })
          continue
        }

        const missing: object[] = []
        const available: object[] = []

        for (const ing of ingredients) {
          const key = `${ing.name.toLowerCase()}::${ing.unit}`
          const inPantry = pantryByKey[key] ?? 0

          if (inPantry >= ing.quantity) {
            available.push({ name: ing.name, needed: ing.quantity, have: inPantry, unit: ing.unit })
          } else if (inPantry > 0) {
            missing.push({
              name: ing.name,
              needed: ing.quantity,
              have: inPantry,
              short_by: Math.round((ing.quantity - inPantry) * 100) / 100,
              unit: ing.unit,
              reason: 'insufficient',
            })
          } else {
            // Check if we have it in a different unit
            const alternatives = pantryByName[ing.name.toLowerCase()]
            if (alternatives && alternatives.length > 0) {
              available.push({
                name: ing.name,
                needed: ing.quantity,
                unit: ing.unit,
                note: `Have ${alternatives[0].quantity} ${alternatives[0].unit} (different unit — verify manually)`,
              })
            } else {
              missing.push({ name: ing.name, needed: ing.quantity, unit: ing.unit, reason: 'not_in_pantry' })
            }
          }
        }

        const entry = {
          id: recipe.id,
          name: recipe.name,
          servings: recipe.servings,
          prep_time: recipe.prepTime,
          cook_time: recipe.cookTime,
          missing_count: missing.length,
          total_ingredients: ingredients.length,
          missing,
          available,
        }

        if (missing.length === 0) {
          canCook.push(entry)
        } else if (available.length > 0) {
          almostCook.push(entry)
        } else {
          cannotCook.push(entry)
        }
      }

      // Sort "almost" by fewest missing items first
      almostCook.sort((a, b) => (a as { missing_count: number }).missing_count - (b as { missing_count: number }).missing_count)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: `${canCook.length} ready to cook, ${almostCook.length} nearly ready, ${cannotCook.length} not possible`,
            can_cook_now: canCook,
            almost_ready: almostCook,
            cannot_cook: cannotCook.map(r => ({ id: (r as { id: string }).id, name: (r as { name: string }).name })),
          }),
        }],
      }
    }
  )

  /**
   * Tool 14: generate_shopping_list
   * Aggregate — compute what to buy for a recipe or meal plan
   */
  server.tool(
    'generate_shopping_list',
    'Generate a shopping list for a specific recipe OR for all meals in a date range. Automatically subtracts what you already have in your pantry so you only see what you actually need to buy.',
    {
      recipe_id: z.string().optional().describe('Generate list for a single recipe (provide this OR date range)'),
      start_date: z.string().optional().describe('Start date YYYY-MM-DD for meal-plan-based list'),
      end_date: z.string().optional().describe('End date YYYY-MM-DD for meal-plan-based list'),
      servings_override: z.number().int().min(1).optional().describe('Override servings count when using recipe_id'),
    },
    async ({ recipe_id, start_date, end_date, servings_override }) => {
      const db = getDb()

      if (!recipe_id && !(start_date && end_date)) {
        return {
          content: [{ type: 'text', text: 'Provide either recipe_id or both start_date and end_date.' }],
          isError: true,
        }
      }

      // required[name::unit] = { quantity, fromRecipes[] }
      const required: Record<string, { quantity: number; unit: string; fromRecipes: string[] }> = {}

      if (recipe_id) {
        const [recipe] = await db
          .select()
          .from(recipes)
          .where(and(eq(recipes.id, recipe_id), eq(recipes.userId, userId)))

        if (!recipe) {
          return { content: [{ type: 'text', text: 'Recipe not found.' }], isError: true }
        }

        const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe_id))
        const mult = servings_override ? servings_override / (recipe.servings ?? 4) : 1

        for (const ing of ings) {
          const key = `${ing.name.toLowerCase()}::${ing.unit}`
          if (!required[key]) required[key] = { quantity: 0, unit: ing.unit, fromRecipes: [] }
          required[key].quantity += ing.quantity * mult
          if (!required[key].fromRecipes.includes(recipe.name)) required[key].fromRecipes.push(recipe.name)
        }
      } else {
        const plans = await db
          .select({
            servings: mealPlans.servings,
            recipeId: recipes.id,
            recipeName: recipes.name,
            recipeServings: recipes.servings,
          })
          .from(mealPlans)
          .innerJoin(recipes, eq(mealPlans.recipeId, recipes.id))
          .where(and(
            eq(mealPlans.userId, userId),
            gte(mealPlans.date, start_date!),
            lte(mealPlans.date, end_date!)
          ))

        for (const plan of plans) {
          const mult = (plan.servings ?? 1) / (plan.recipeServings ?? 4)
          const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, plan.recipeId))

          for (const ing of ings) {
            const key = `${ing.name.toLowerCase()}::${ing.unit}`
            if (!required[key]) required[key] = { quantity: 0, unit: ing.unit, fromRecipes: [] }
            required[key].quantity += ing.quantity * mult
            if (!required[key].fromRecipes.includes(plan.recipeName)) required[key].fromRecipes.push(plan.recipeName)
          }
        }
      }

      if (Object.keys(required).length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ message: 'No ingredients found for the given input.', shopping_list: [] }) }],
        }
      }

      // Subtract pantry
      const pantry = await db.select().from(pantryItems).where(eq(pantryItems.userId, userId))
      const pantryByKey: Record<string, number> = {}
      for (const item of pantry) {
        const key = `${item.name.toLowerCase()}::${item.unit}`
        pantryByKey[key] = (pantryByKey[key] ?? 0) + item.quantity
      }

      const toBuy: object[] = []
      const alreadyHave: object[] = []

      for (const [key, req] of Object.entries(required)) {
        const [nameLower] = key.split('::')
        const displayName = nameLower.charAt(0).toUpperCase() + nameLower.slice(1)
        const inPantry = pantryByKey[key] ?? 0
        const needed = Math.ceil((req.quantity - inPantry) * 10) / 10

        if (needed <= 0) {
          alreadyHave.push({ name: displayName, quantity: Math.round(req.quantity * 10) / 10, unit: req.unit, in_pantry: inPantry })
        } else {
          toBuy.push({
            name: displayName,
            quantity: needed,
            unit: req.unit,
            in_pantry: inPantry,
            for_recipes: req.fromRecipes,
          })
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            shopping_list: toBuy,
            already_have: alreadyHave,
            items_to_buy: toBuy.length,
          }),
        }],
      }
    }
  )
}
