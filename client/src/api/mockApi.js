// The simulated backend.
//
// Same function names, same return types, and the same shape of failure as
// httpApi.js, so your components cannot tell the difference. Data lives in the
// visitor's own browser and goes no further.
//
// This exists so the template's GitHub Pages link works on day one and so you
// can build the interface before your API is deployed. It is NOT a finished
// project. See content/extending-your-app page 3.

// The same 40 recipes the database is seeded with (server/db/seed.js), so demo
// mode and the real API start from identical data. Ids are 1 to 40 in list
// order, which is also what the seeded database gives them.
import starterRecipes from '../../../server/db/recipes.js'
import { buildShoppingList, customItem } from '../../../server/db/shoppingList.js'

const KEY = 'plan-a-meal:data'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// A real network is not instant. Keeping this delay is what forces you to build
// a loading state now, while it is cheap, instead of discovering you need one
// the day you switch to the real API.
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

function seed() {
  let nextIngredientId = 1
  return {
    recipes: starterRecipes.map((recipe, index) => ({
      id: index + 1,
      name: recipe.name,
      cuisine: recipe.cuisine,
      minutes: recipe.minutes,
      ingredients: recipe.ingredients.map((ingredient) => ({
        id: nextIngredientId++,
        ...ingredient,
      })),
    })),
    mealPlan: [],
    shoppingChecks: {},
    shoppingItems: [],
    nextIngredientId,
    nextMealPlanId: 1,
    nextShoppingItemId: 1,
  }
}

function read() {
  const stored = localStorage.getItem(KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      // Corrupted storage. Start again rather than crashing the app.
      localStorage.removeItem(KEY)
    }
  }
  return write(seed())
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
  return data
}

function findRecipe(data, id) {
  const found = data.recipes.find((recipe) => String(recipe.id) === String(id))
  if (!found) throw new Error('Not found')
  return found
}

// Image and calories are read from server/db/recipes.js every time rather than
// from storage, so editing them there shows up on the next reload without
// clearing the saved demo data.
const withStatic = (recipe) => ({
  ...recipe,
  image: starterRecipes[recipe.id - 1]?.image ?? '',
  calories: starterRecipes[recipe.id - 1]?.calories ?? 0,
})

const totalCost = (ingredients) =>
  ingredients.reduce((sum, item) => sum + item.estimated_cost, 0)

export async function listRecipes() {
  await delay()
  return read().recipes.map(({ ingredients, ...recipe }) => ({
    ...withStatic(recipe),
    ingredient_count: ingredients.length,
    total_cost: totalCost(ingredients),
  }))
}

export async function getRecipe(id) {
  await delay()
  return withStatic(findRecipe(read(), id))
}

export async function updateRecipeIngredients(id, ingredients) {
  await delay()
  const data = read()
  const recipe = findRecipe(data, id)
  recipe.ingredients = ingredients.map((ingredient) => ({
    id: data.nextIngredientId++,
    name: ingredient.name,
    quantity: Number(ingredient.quantity),
    unit: ingredient.unit,
    estimated_cost: Number(ingredient.estimated_cost),
  }))
  write(data)
  return withStatic(recipe)
}

// Only the requested week's entries, which is what makes the plan start empty
// each Monday. Entries saved before weeks existed have no week_start, so they
// never match and simply stop showing.
const entriesForWeek = (data, weekStart) =>
  data.mealPlan.filter((entry) => entry.week_start === weekStart)

export async function listMealPlan(weekStart) {
  await delay()
  const data = read()
  return entriesForWeek(data, weekStart)
    .map((entry) => {
      const recipe = withStatic(findRecipe(data, entry.recipe_id))
      return {
        ...entry,
        recipe_name: recipe.name,
        image: recipe.image,
        calories: recipe.calories,
        total_cost: totalCost(recipe.ingredients),
      }
    })
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
}

export async function addToMealPlan({ recipe_id, day, week_start }) {
  await delay()
  const data = read()
  const recipe = data.recipes.find((row) => String(row.id) === String(recipe_id))
  if (!recipe) throw new Error('No such recipe')
  if (!DAYS.includes(day)) throw new Error(`day must be one of ${DAYS.join(', ')}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start ?? '')) {
    throw new Error('week must be a Monday, written YYYY-MM-DD')
  }

  // Same rule as the database: one entry per recipe per day, per week.
  const existing = entriesForWeek(data, week_start).find(
    (entry) => entry.recipe_id === recipe.id && entry.day === day
  )
  if (existing) return existing

  const created = {
    id: data.nextMealPlanId++,
    recipe_id: recipe.id,
    week_start,
    day,
    added_at: new Date().toISOString(),
  }
  data.mealPlan.push(created)
  write(data)
  return created
}

export async function removeFromMealPlan(id) {
  await delay()
  const data = read()
  const before = data.mealPlan.length
  data.mealPlan = data.mealPlan.filter((entry) => String(entry.id) !== String(id))
  if (data.mealPlan.length === before) throw new Error('Not found')
  write(data)
  return null
}

export async function getShoppingList(weekStart) {
  await delay()
  const data = read()
  const lines = entriesForWeek(data, weekStart).flatMap((entry) => {
    const recipe = findRecipe(data, entry.recipe_id)
    return recipe.ingredients.map((ingredient) => ({ ...ingredient, recipe_name: recipe.name }))
  })
  const added = (data.shoppingItems ?? []).filter((item) => item.week_start === weekStart)
  return buildShoppingList(lines, data.shoppingChecks?.[weekStart] ?? [], added)
}

// item: { week_start, name, amount, estimated_cost }. Returns the new list line.
export async function addShoppingItem({ week_start, name, amount, estimated_cost }) {
  await delay()
  const data = read()
  if (!name?.trim()) throw new Error('name is required')
  data.shoppingItems ??= []
  data.nextShoppingItemId ??= 1
  const row = {
    id: data.nextShoppingItemId++,
    week_start,
    name: name.trim(),
    amount: (amount ?? '').trim(),
    estimated_cost: Number(estimated_cost) || 0,
  }
  data.shoppingItems.push(row)
  write(data)
  return customItem(row)
}

export async function removeShoppingItem(id) {
  await delay()
  const data = read()
  const row = (data.shoppingItems ?? []).find((item) => String(item.id) === String(id))
  if (!row) throw new Error('Not found')
  data.shoppingItems = data.shoppingItems.filter((item) => item !== row)
  // Its tick, if it had one, would otherwise stay behind.
  const checks = data.shoppingChecks?.[row.week_start]
  if (checks) data.shoppingChecks[row.week_start] = checks.filter((key) => key !== `custom:${id}`)
  write(data)
  return null
}

export async function setShoppingItemChecked({ week_start, item_key, checked }) {
  await delay()
  const data = read()
  data.shoppingChecks ??= {}
  const keys = new Set(data.shoppingChecks[week_start] ?? [])
  if (checked) keys.add(item_key)
  else keys.delete(item_key)
  data.shoppingChecks[week_start] = [...keys]
  write(data)
  return { week_start, item_key, checked }
}
