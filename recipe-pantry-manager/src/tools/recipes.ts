import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, like } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { recipes, recipeIngredients } from '../db/schema.js'

function makeId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

export function registerRecipeTools(server: McpServer, userId: string) {
  /**
   * Tool 1: list_recipes
   * Read — lists all of the user's recipes
   */
  server.tool(
    'list_recipes',
    'List all recipes saved by the current user. Optionally filter by name.',
    {
      search: z.string().optional().describe('Filter recipes by name (partial match)'),
    },
    async ({ search }) => {
      const db = getDb()
      let rows
      if (search) {
        rows = await db
          .select()
          .from(recipes)
          .where(and(eq(recipes.userId, userId), like(recipes.name, `%${search}%`)))
      } else {
        rows = await db.select().from(recipes).where(eq(recipes.userId, userId))
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ recipes: rows, count: rows.length }),
        }],
      }
    }
  )

  /**
   * Tool 2: get_recipe
   * Read — fetch a single recipe with full ingredient list
   */
  server.tool(
    'get_recipe',
    'Get the full details of a recipe including all ingredients and instructions.',
    {
      recipe_id: z.string().describe('The ID of the recipe to retrieve'),
    },
    async ({ recipe_id }) => {
      const db = getDb()
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

      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, recipe_id))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ...recipe, ingredients }),
        }],
      }
    }
  )

  /**
   * Tool 3: create_recipe
   * Write — create a new recipe with ingredients
   */
  server.tool(
    'create_recipe',
    'Create a new recipe with ingredients. Returns the new recipe ID.',
    {
      name: z.string().min(1).describe('Recipe name'),
      description: z.string().optional().describe('Short description of the dish'),
      servings: z.number().int().min(1).optional().default(4).describe('Default number of servings'),
      prep_time: z.number().int().min(0).optional().describe('Preparation time in minutes'),
      cook_time: z.number().int().min(0).optional().describe('Cooking/baking time in minutes'),
      instructions: z.string().optional().describe('Step-by-step cooking instructions'),
      ingredients: z.array(z.object({
        name: z.string().describe('Ingredient name (e.g., "chicken breast", "all-purpose flour")'),
        quantity: z.number().positive().describe('Amount required'),
        unit: z.string().describe('Unit of measurement (e.g., grams, cups, tbsp, pieces)'),
      })).min(1).describe('List of ingredients required for this recipe'),
    },
    async ({ name, description, servings, prep_time, cook_time, instructions, ingredients }) => {
      const db = getDb()
      const id = makeId()
      const now = new Date()

      await db.insert(recipes).values({
        id,
        userId,
        name,
        description,
        servings,
        prepTime: prep_time,
        cookTime: cook_time,
        instructions,
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(recipeIngredients).values(
        ingredients.map(ing => ({
          id: makeId(),
          recipeId: id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        }))
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Recipe "${name}" created successfully`,
            recipe_id: id,
          }),
        }],
      }
    }
  )

  /**
   * Tool 4: delete_recipe
   * Write — permanently remove a recipe
   */
  server.tool(
    'delete_recipe',
    'Permanently delete a recipe and remove it from any meal plans.',
    {
      recipe_id: z.string().describe('The ID of the recipe to delete'),
    },
    async ({ recipe_id }) => {
      const db = getDb()
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

      await db.delete(recipes).where(eq(recipes.id, recipe_id))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: `Recipe "${recipe.name}" deleted.` }),
        }],
      }
    }
  )
}
