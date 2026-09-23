// Load the 40 starter recipes from db/recipes.js into the database.
//
//   node --env-file=.env db/seed.js
//
// This starts with TRUNCATE, which also empties the meal plan and the shopping
// list's ticks. That is correct
// on your laptop and catastrophic against the database your live demo depends
// on. Check which DATABASE_URL is loaded before you run it.
//
// It is a script rather than a seed.sql so the recipe list lives in one place,
// db/recipes.js, which the client's demo mode reads as well.

import { pool } from './pool.js'
import recipes from './recipes.js'

const client = await pool.connect()

try {
  await client.query('BEGIN')
  await client.query(
    'TRUNCATE TABLE shopping_checks, meal_plan, ingredients, recipes RESTART IDENTITY CASCADE'
  )

  for (const recipe of recipes) {
    const { rows } = await client.query(
      `INSERT INTO recipes (name, cuisine, minutes, image, calories)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [recipe.name, recipe.cuisine, recipe.minutes, recipe.image ?? '', recipe.calories ?? 0]
    )

    for (const [position, ingredient] of recipe.ingredients.entries()) {
      await client.query(
        `INSERT INTO ingredients (recipe_id, name, quantity, unit, estimated_cost, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rows[0].id, ingredient.name, ingredient.quantity, ingredient.unit,
          ingredient.estimated_cost, position]
      )
    }
  }

  await client.query('COMMIT')
  console.log(`seeded ${recipes.length} recipes`)
} catch (error) {
  await client.query('ROLLBACK')
  console.error(`seed failed: ${error.message}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
