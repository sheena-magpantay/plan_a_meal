// The data-access layer for recipes, ingredients, the meal plan and the
// shopping list.
//
// Every query is parameterised: values go in the array, never into the string.
// This is the single most important habit in database code, and it is what
// stops "'; DROP TABLE recipes; --" in a form field from being a real problem.
//
// NUMERIC columns come back from pg as strings (so no precision is lost), which
// is why quantity and cost are cast to double precision here: the client wants numbers.

import { buildShoppingList } from './db/shoppingList.js'

export const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

// The list page shows every recipe with its ingredient count and total cost.
export async function listRecipes(pool) {
  const result = await pool.query(
    `SELECT r.id, r.name, r.cuisine, r.minutes, r.image, r.calories,
            COUNT(i.id)::int AS ingredient_count,
            COALESCE(SUM(i.estimated_cost), 0)::double precision AS total_cost
     FROM recipes r
     LEFT JOIN ingredients i ON i.recipe_id = r.id
     GROUP BY r.id, r.name, r.cuisine, r.minutes, r.image, r.calories
     ORDER BY r.id`
  )
  return result.rows
}

export async function getRecipe(pool, id) {
  const recipe = await pool.query(
    'SELECT id, name, cuisine, minutes, image, calories FROM recipes WHERE id = $1',
    [id]
  )
  if (!recipe.rows[0]) return null

  const ingredients = await pool.query(
    `SELECT id, name, quantity::double precision AS quantity, unit,
            estimated_cost::double precision AS estimated_cost
     FROM ingredients
     WHERE recipe_id = $1
     ORDER BY position, id`,
    [id]
  )
  return { ...recipe.rows[0], ingredients: ingredients.rows }
}

// Saving the edit screen replaces the whole ingredient list in one transaction,
// so a failure halfway through never leaves a recipe with half its ingredients.
export async function replaceIngredients(pool, id, ingredients) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const exists = await client.query('SELECT id FROM recipes WHERE id = $1', [id])
    if (exists.rowCount === 0) {
      await client.query('ROLLBACK')
      return null
    }

    await client.query('DELETE FROM ingredients WHERE recipe_id = $1', [id])
    for (const [position, ingredient] of ingredients.entries()) {
      await client.query(
        `INSERT INTO ingredients (recipe_id, name, quantity, unit, estimated_cost, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, ingredient.name, ingredient.quantity, ingredient.unit,
          ingredient.estimated_cost, position]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return getRecipe(pool, id)
}

// One week of the plan, sorted Monday to Sunday, then by when each recipe was
// added. Each entry carries what the home screen shows: the recipe's name,
// image, calories and total ingredient cost.
//
// week_start is not read back from the DATE column: pg would turn it into a
// JavaScript Date at local midnight, which can shift it by a day depending on
// time zone. It is the week that was asked for, so it is added from that.
export async function listMealPlan(pool, weekStart) {
  const result = await pool.query(
    `SELECT m.id, m.recipe_id, m.day, m.added_at,
            r.name AS recipe_name, r.image, r.calories,
            COALESCE(SUM(i.estimated_cost), 0)::double precision AS total_cost
     FROM meal_plan m
     JOIN recipes r ON r.id = m.recipe_id
     LEFT JOIN ingredients i ON i.recipe_id = r.id
     WHERE m.week_start = $1
     GROUP BY m.id, m.recipe_id, m.week_start, m.day, m.added_at, r.name, r.image, r.calories
     ORDER BY m.added_at`,
    [weekStart]
  )
  return result.rows
    .map((row) => ({ ...row, week_start: weekStart }))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
}

// Adding the same recipe to the same day of the same week twice is not an
// error; it returns the entry that is already there. Returns null if the
// recipe does not exist.
export async function addToMealPlan(pool, { recipe_id, day, week_start }) {
  try {
    const result = await pool.query(
      `INSERT INTO meal_plan (recipe_id, day, week_start)
       VALUES ($1, $2, $3)
       ON CONFLICT (week_start, recipe_id, day) DO UPDATE SET day = EXCLUDED.day
       RETURNING id, recipe_id, day, added_at`,
      [recipe_id, day, week_start]
    )
    return { ...result.rows[0], week_start }
  } catch (error) {
    // 23503 is a foreign key violation: no recipe with that id.
    if (error.code === '23503') return null
    throw error
  }
}

export async function removeFromMealPlan(pool, id) {
  const result = await pool.query('DELETE FROM meal_plan WHERE id = $1 RETURNING id', [id])
  return result.rowCount > 0
}

// Every ingredient of every recipe planned for the week, combined into one
// list (see db/shoppingList.js), with each line's ticked state.
export async function getShoppingList(pool, weekStart) {
  const lines = await pool.query(
    `SELECT i.name, i.quantity::double precision AS quantity, i.unit,
            i.estimated_cost::double precision AS estimated_cost,
            r.name AS recipe_name
     FROM meal_plan m
     JOIN recipes r ON r.id = m.recipe_id
     JOIN ingredients i ON i.recipe_id = r.id
     WHERE m.week_start = $1
     ORDER BY m.added_at, i.position`,
    [weekStart]
  )
  const checks = await pool.query(
    'SELECT item_key FROM shopping_checks WHERE week_start = $1',
    [weekStart]
  )
  return buildShoppingList(lines.rows, checks.rows.map((row) => row.item_key))
}

export async function setShoppingItemChecked(pool, { week_start, item_key, checked }) {
  if (checked) {
    await pool.query(
      `INSERT INTO shopping_checks (week_start, item_key) VALUES ($1, $2)
       ON CONFLICT (week_start, item_key) DO NOTHING`,
      [week_start, item_key]
    )
  } else {
    await pool.query(
      'DELETE FROM shopping_checks WHERE week_start = $1 AND item_key = $2',
      [week_start, item_key]
    )
  }
  return { week_start, item_key, checked }
}
