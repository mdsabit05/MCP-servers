import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, like, lte, gte, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { pantryItems } from '../db/schema.js'

function makeId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

export function registerPantryTools(server: McpServer, userId: string) {
  /**
   * Tool 5: list_pantry
   * Read — list all pantry items, optionally by category
   */
  server.tool(
    'list_pantry',
    'List all items currently in the pantry. Optionally filter by category (produce, dairy, protein, grains, spices, condiments, frozen, canned, beverages, other).',
    {
      category: z.string().optional().describe('Filter by ingredient category'),
    },
    async ({ category }) => {
      const db = getDb()
      const items = await db
        .select()
        .from(pantryItems)
        .where(
          category
            ? and(eq(pantryItems.userId, userId), eq(pantryItems.category, category))
            : eq(pantryItems.userId, userId)
        )
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ items, count: items.length }),
        }],
      }
    }
  )

  /**
   * Tool 6: search_pantry
   * Read — search for an ingredient by name
   */
  server.tool(
    'search_pantry',
    'Search the pantry for a specific ingredient by name (partial match).',
    {
      name: z.string().describe('Ingredient name to search for'),
    },
    async ({ name }) => {
      const db = getDb()
      const items = await db
        .select()
        .from(pantryItems)
        .where(and(
          eq(pantryItems.userId, userId),
          like(pantryItems.name, `%${name}%`)
        ))
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ items, count: items.length }),
        }],
      }
    }
  )

  /**
   * Tool 7: upsert_pantry_item
   * Write — add or update a pantry item (matched by name + unit)
   */
  server.tool(
    'upsert_pantry_item',
    'Add an ingredient to the pantry or update the quantity of an existing one. Items are matched by name and unit — adding "flour" in "grams" twice updates the existing entry.',
    {
      name: z.string().describe('Ingredient name (e.g., "chicken breast", "all-purpose flour")'),
      quantity: z.number().positive().describe('Amount currently available'),
      unit: z.string().describe('Unit of measurement (e.g., grams, cups, pieces, liters, tbsp)'),
      category: z.string().optional().describe('Category: produce, dairy, protein, grains, spices, condiments, frozen, canned, beverages, or other'),
      expiry_date: z.string().optional().describe('Expiry date in YYYY-MM-DD format'),
    },
    async ({ name, quantity, unit, category, expiry_date }) => {
      const db = getDb()

      // Match existing item by case-insensitive name + unit
      const existing = await db
        .select()
        .from(pantryItems)
        .where(and(
          eq(pantryItems.userId, userId),
          sql`lower(${pantryItems.name}) = lower(${name})`,
          eq(pantryItems.unit, unit)
        ))

      if (existing.length > 0) {
        const item = existing[0]
        await db
          .update(pantryItems)
          .set({
            quantity,
            category: category ?? item.category,
            expiryDate: expiry_date ?? item.expiryDate,
            updatedAt: new Date(),
          })
          .where(eq(pantryItems.id, item.id))

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: 'Pantry item updated',
              id: item.id,
              name,
              quantity,
              unit,
            }),
          }],
        }
      }

      const id = makeId()
      await db.insert(pantryItems).values({
        id,
        userId,
        name,
        quantity,
        unit,
        category,
        expiryDate: expiry_date,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: 'Pantry item added', id, name, quantity, unit }),
        }],
      }
    }
  )

  /**
   * Tool 8: remove_pantry_item
   * Write — remove an item from the pantry
   */
  server.tool(
    'remove_pantry_item',
    'Remove an ingredient from the pantry by its ID. Use list_pantry or search_pantry to find the ID.',
    {
      item_id: z.string().describe('The ID of the pantry item to remove'),
    },
    async ({ item_id }) => {
      const db = getDb()
      const [item] = await db
        .select()
        .from(pantryItems)
        .where(and(eq(pantryItems.id, item_id), eq(pantryItems.userId, userId)))

      if (!item) {
        return {
          content: [{ type: 'text', text: 'Pantry item not found or you do not have access to it.' }],
          isError: true,
        }
      }

      await db.delete(pantryItems).where(eq(pantryItems.id, item_id))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: `"${item.name}" removed from pantry.` }),
        }],
      }
    }
  )

  /**
   * Tool 9: get_expiring_soon
   * Computed — find items expiring within N days
   */
  server.tool(
    'get_expiring_soon',
    'Find pantry items that are expiring soon. Helps you plan meals around perishables before they go to waste.',
    {
      days: z.number().int().min(1).max(30).default(7).describe('How many days ahead to look (default: 7)'),
    },
    async ({ days }) => {
      const db = getDb()
      const today = new Date()
      const future = new Date(today)
      future.setDate(future.getDate() + days)

      const todayStr = today.toISOString().split('T')[0]
      const futureStr = future.toISOString().split('T')[0]

      const expiringSoon = await db
        .select()
        .from(pantryItems)
        .where(and(
          eq(pantryItems.userId, userId),
          sql`${pantryItems.expiryDate} IS NOT NULL`,
          gte(pantryItems.expiryDate, todayStr),
          lte(pantryItems.expiryDate, futureStr)
        ))

      const alreadyExpired = await db
        .select()
        .from(pantryItems)
        .where(and(
          eq(pantryItems.userId, userId),
          sql`${pantryItems.expiryDate} IS NOT NULL`,
          sql`${pantryItems.expiryDate} < ${todayStr}`
        ))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            expiring_within_days: days,
            expiring_soon: expiringSoon,
            already_expired: alreadyExpired,
          }),
        }],
      }
    }
  )
}
