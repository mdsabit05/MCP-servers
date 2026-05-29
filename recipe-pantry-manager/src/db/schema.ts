import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

function randomId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey().$defaultFn(randomId),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  servings: integer('servings').default(4),
  prepTime: integer('prep_time'),  // minutes
  cookTime: integer('cook_time'),  // minutes
  instructions: text('instructions'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const recipeIngredients = sqliteTable('recipe_ingredients', {
  id: text('id').primaryKey().$defaultFn(randomId),
  recipeId: text('recipe_id').notNull(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
})

export const pantryItems = sqliteTable('pantry_items', {
  id: text('id').primaryKey().$defaultFn(randomId),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull().default(1),
  unit: text('unit').notNull().default('piece'),
  category: text('category'),       // produce, dairy, protein, grains, spices, etc.
  expiryDate: text('expiry_date'),  // YYYY-MM-DD
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const mealPlans = sqliteTable('meal_plans', {
  id: text('id').primaryKey().$defaultFn(randomId),
  userId: text('user_id').notNull(),
  date: text('date').notNull(),       // YYYY-MM-DD
  mealType: text('meal_type').notNull(), // breakfast, lunch, dinner, snack
  recipeId: text('recipe_id').notNull(),
  servings: integer('servings').default(1),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
