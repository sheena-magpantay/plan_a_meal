import express from 'express'
import cors from 'cors'
import { pool } from './db/pool.js'
import * as recipes from './recipesRepo.js'

const app = express()
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '100kb' }))

app.get('/healthz', (request, response) => {
  response.json({ ok: true })
})

app.get('/readyz', async (request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, db: 'up' })
  } catch (error) {
    console.error('readyz failed:', error.message)
    response.status(503).json({ ok: false, db: 'down' })
  }
})

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

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

const CUISINES = ['Filipino', 'Chinese', 'Western']

function validateRecipe(body) {
  const errors = []
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const minutes = Number(body.minutes)
  const calories = body.calories === undefined || body.calories === '' ? 0 : Number(body.calories)

  if (!name) errors.push('name is required')
  if (name.length > 120) errors.push('name must be 120 characters or fewer')
  if (!CUISINES.includes(body.cuisine)) errors.push(`cuisine must be one of ${CUISINES.join(', ')}`)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    errors.push('minutes must be a whole number from 1 to 1440')
  }
  if (!Number.isInteger(calories) || calories < 0 || calories > 10000) {
    errors.push('calories must be a whole number from 0 to 10000')
  }
  if (image.length > 500) errors.push('image must be 500 characters or fewer')

  return { errors, value: { name, cuisine: body.cuisine, minutes, calories, image } }
}

function validateQuantity(body) {
  const errors = []
  const week_start = parseWeek(body.week_start)
  const item_key = typeof body.item_key === 'string' ? body.item_key : ''
  const quantity = body.quantity === null ? null : Number(body.quantity)

  if (!week_start) errors.push(WEEK_ERROR)
  if (!item_key || item_key.length > 200) errors.push('item_key is required')
  if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)) {
    errors.push('quantity must be a number above 0, or null to reset it')
  }

  return { errors, value: { week_start, item_key, quantity } }
}

function validateShoppingItem(body) {
  const errors = []
  const week_start = parseWeek(body.week_start)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const unit = typeof body.unit === 'string' ? body.unit.trim() : ''
  const quantity = Number(body.quantity)

  if (!week_start) errors.push(WEEK_ERROR)
  if (!name) errors.push('name is required')
  if (name.length > 120) errors.push('name must be 120 characters or fewer')
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
    errors.push('quantity must be a number above 0')
  }
  if (unit.length > 20) errors.push('unit must be 20 characters or fewer')

  return { errors, value: { week_start, name, quantity, unit } }
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

app.post('/api/recipes', async (request, response, next) => {
  const { errors, value } = validateRecipe(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    response.status(201).json(await recipes.createRecipe(pool, value))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/recipes/:id', async (request, response, next) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(404).json({ error: 'Not found' })

  try {
    const removed = await recipes.deleteRecipe(pool, id)
    if (!removed) return response.status(404).json({ error: 'Not found' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.put('/api/recipes/:id/ingredients', async (request, response, next) => {
  const id = parseId(request.params.id)
  if (!id) return response.status(404).json({ error: 'Not found' })

  const { errors, value } = validateIngredients(request.body ?? {})
  const servings = request.body?.servings == null ? null : Number(request.body.servings)
  if (servings !== null && (!Number.isInteger(servings) || servings < 1 || servings > 100)) {
    errors.push('servings must be a whole number from 1 to 100')
  }
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    const recipe = await recipes.replaceIngredients(pool, id, value, servings)
    if (!recipe) return response.status(404).json({ error: 'Not found' })
    response.json(recipe)
  } catch (error) {
    next(error)
  }
})

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

app.get('/api/shopping-list', async (request, response, next) => {
  const week = parseWeek(request.query.week)
  if (!week) return response.status(400).json({ error: WEEK_ERROR })

  try {
    response.json(await recipes.getShoppingList(pool, week))
  } catch (error) {
    next(error)
  }
})

app.put('/api/shopping-list/checks', async (request, response, next) => {
  const { errors, value } = validateCheck(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    response.json(await recipes.setShoppingItemChecked(pool, value))
  } catch (error) {
    next(error)
  }
})

app.put('/api/shopping-list/quantities', async (request, response, next) => {
  const { errors, value } = validateQuantity(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    response.json(await recipes.setShoppingItemQuantity(pool, value))
  } catch (error) {
    next(error)
  }
})

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

app.use((error, request, response, next) => {
  console.error(error)
  response.status(500).json({ error: 'Something went wrong on the server' })
})

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
  console.log(`CORS allows: ${allowedOrigins.join(', ')}`)
})
