import express from 'express'
import cors from 'cors'
import { pool } from './db/pool.js'
import * as recipes from './recipesRepo.js'

const app = express()

// CORS before the routes. Middleware registered after a route never sees that
// route's requests, which is the m4 lesson showing up in production.
//
// Name your origins. app.use(cors()) with no options sends
// Access-Control-Allow-Origin: *, which lets any site on the internet call this
// API from a visitor's browser, and is incompatible with cookies.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '100kb' }))

// Is the process alive?
app.get('/healthz', (request, response) => {
  response.json({ ok: true })
})

// Is the database reachable? A different question, and the one that tells you
// in two seconds which half of a problem you have.
app.get('/readyz', async (request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, db: 'up' })
  } catch (error) {
    console.error('readyz failed:', error.message)
    response.status(503).json({ ok: false, db: 'down' })
  }
})

// Ids are SERIAL integers. Anything else cannot match a row, and passing it to
// PostgreSQL would be a 500 (invalid input syntax) instead of a 404.
function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Validation lives on the server because the client can be bypassed. The
// browser form is for a fast, friendly message; this is for correctness.
function validateIngredients(body) {
  if (!Array.isArray(body.ingredients)) {
    return { errors: ['ingredients must be a list'], value: [] }
  }

  const errors = []
  if (body.ingredients.length > 100) errors.push('a recipe can have at most 100 ingredients')

  const value = body.ingredients.map((item, index) => {
    const n = index + 1
    const name = typeof item?.name === 'string' ? item.name.trim() : ''
    const unit = typeof item?.unit === 'string' ? item.unit.trim() : ''
    const quantity = Number(item?.quantity)
    const cost = Number(item?.estimated_cost)

    if (!name) errors.push(`ingredient ${n}: name is required`)
    if (name.length > 120) errors.push(`ingredient ${n}: name must be 120 characters or fewer`)
    if (unit.length > 20) errors.push(`ingredient ${n}: unit must be 20 characters or fewer`)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      errors.push(`ingredient ${n}: quantity must be a number above 0`)
    }
    if (!Number.isFinite(cost) || cost < 0 || cost > 1000000) {
      errors.push(`ingredient ${n}: estimated cost must be a number, 0 or more`)
    }

    return { name, unit, quantity, estimated_cost: cost }
  })

  return { errors, value }
}

// A week is named by its Monday, as YYYY-MM-DD. The client works out which
// Monday "this week" is in the user's own time zone and sends it, because the
// server's clock may be in a different one.
function parseWeek(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  return date.getUTCDay() === 1 ? value : null
}

const WEEK_ERROR = 'week must be a Monday, written YYYY-MM-DD'

function validateMealPlanEntry(body) {
  const errors = []
  const recipe_id = parseId(body.recipe_id)
  const day = body.day
  const week_start = parseWeek(body.week_start)

  if (!recipe_id) errors.push('recipe_id must be a recipe id')
  if (!recipes.DAYS.includes(day)) errors.push(`day must be one of ${recipes.DAYS.join(', ')}`)
  if (!week_start) errors.push(WEEK_ERROR)

  return { errors, value: { recipe_id, day, week_start } }
}

function validateCheck(body) {
  const errors = []
  const week_start = parseWeek(body.week_start)
  const item_key = typeof body.item_key === 'string' ? body.item_key : ''

  if (!week_start) errors.push(WEEK_ERROR)
  if (!item_key || item_key.length > 200) errors.push('item_key is required')
  if (typeof body.checked !== 'boolean') errors.push('checked must be true or false')

  return { errors, value: { week_start, item_key, checked: body.checked } }
}

function validateShoppingItem(body) {
  const errors = []
  const week_start = parseWeek(body.week_start)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const amount = typeof body.amount === 'string' ? body.amount.trim() : ''
  const cost = body.estimated_cost === undefined || body.estimated_cost === '' ? 0 : Number(body.estimated_cost)

  if (!week_start) errors.push(WEEK_ERROR)
  if (!name) errors.push('name is required')
  if (name.length > 120) errors.push('name must be 120 characters or fewer')
  if (amount.length > 40) errors.push('amount must be 40 characters or fewer')
  if (!Number.isFinite(cost) || cost < 0 || cost > 1000000) {
    errors.push('estimated cost must be a number, 0 or more')
  }

  return { errors, value: { week_start, name, amount, estimated_cost: cost } }
}

app.get('/api/recipes', async (request, response, next) => {
  try {
    response.json(await recipes.listRecipes(pool))
  } catch (error) {
    next(error)
  }
})

app.get('/api/recipes/:id', async (request, response, next) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(404).json({ error: 'Not found' })

  try {
    const recipe = await recipes.getRecipe(pool, id)
    if (!recipe) return response.status(404).json({ error: 'Not found' })
    response.json(recipe)
  } catch (error) {
    next(error)
  }
})

app.put('/api/recipes/:id/ingredients', async (request, response, next) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(404).json({ error: 'Not found' })

  const { errors, value } = validateIngredients(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    const recipe = await recipes.replaceIngredients(pool, id, value)
    if (!recipe) return response.status(404).json({ error: 'Not found' })
    response.json(recipe)
  } catch (error) {
    next(error)
  }
})

// GET /api/meal-plan?week=2026-09-21
app.get('/api/meal-plan', async (request, response, next) => {
  const week = parseWeek(request.query.week)
  if (!week) return response.status(400).json({ error: WEEK_ERROR })

  try {
    response.json(await recipes.listMealPlan(pool, week))
  } catch (error) {
    next(error)
  }
})

app.post('/api/meal-plan', async (request, response, next) => {
  const { errors, value } = validateMealPlanEntry(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    const entry = await recipes.addToMealPlan(pool, value)
    if (!entry) return response.status(404).json({ error: 'No such recipe' })
    response.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/meal-plan/:id', async (request, response, next) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(404).json({ error: 'Not found' })

  try {
    const removed = await recipes.removeFromMealPlan(pool, id)
    if (!removed) return response.status(404).json({ error: 'Not found' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

// GET /api/shopping-list?week=2026-09-21
app.get('/api/shopping-list', async (request, response, next) => {
  const week = parseWeek(request.query.week)
  if (!week) return response.status(400).json({ error: WEEK_ERROR })

  try {
    response.json(await recipes.getShoppingList(pool, week))
  } catch (error) {
    next(error)
  }
})

// Tick or untick one line: { week_start, item_key, checked }
app.put('/api/shopping-list/checks', async (request, response, next) => {
  const { errors, value } = validateCheck(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    response.json(await recipes.setShoppingItemChecked(pool, value))
  } catch (error) {
    next(error)
  }
})

// Add something to the list by hand: { week_start, name, amount, estimated_cost }
app.post('/api/shopping-list/items', async (request, response, next) => {
  const { errors, value } = validateShoppingItem(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    response.status(201).json(await recipes.addShoppingItem(pool, value))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/shopping-list/items/:id', async (request, response, next) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(404).json({ error: 'Not found' })

  try {
    const removed = await recipes.removeShoppingItem(pool, id)
    if (!removed) return response.status(404).json({ error: 'Not found' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use((request, response) => {
  response.status(404).json({ error: 'No such route' })
})

// The detail goes in your logs; the visitor gets a plain message. Sending a
// stack trace to a stranger tells them about your file layout and dependencies.
app.use((error, request, response, next) => {
  console.error(error)
  response.status(500).json({ error: 'Something went wrong on the server' })
})

// The host chooses the port and tells you through PORT. Hardcoding 3000 is the
// commonest reason a first deploy is marked unhealthy and killed.
const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
  console.log(`CORS allows: ${allowedOrigins.join(', ')}`)
})
