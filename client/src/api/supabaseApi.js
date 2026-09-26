// The Supabase backend: each signed-in user's own week, saved to their account.
//
// Same function names, same return types and the same shape of failure as
// mockApi.js and httpApi.js, so the screens cannot tell the difference.
//
// Recipes come from server/db/recipes.js, bundled with the client like demo
// mode. Supabase stores only what a user changes (supabase/schema.sql):
//   meal_plan           their weekly plan
//   shopping_checks     items ticked on the shopping list
//   recipe_ingredients  their own edits to a recipe's ingredients
//   shopping_items      things they added to the shopping list by hand
//   user_recipes        recipes they added themselves (ids from 1001)
//   shopping_quantities quantities they changed on the shopping list
// Row Level Security limits every query to the signed-in user's rows, which
// is why nothing below filters by user.

import { supabase } from '../supabase.js'
import starterRecipes from '../../../server/db/recipes.js'
import { buildShoppingList, customItem, catalogPrices } from '../../../server/db/shoppingList.js'
import { AI_ENABLED, estimateItemCost } from './ai.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Ids are 1 to 40 in list order, the same as demo mode and the seeded database.
const withIds = (recipeId, ingredients) =>
  ingredients.map((ingredient, index) => ({ id: `${recipeId}-${index + 1}`, ...ingredient }))

const bundledRecipes = starterRecipes.map((recipe, index) => ({
  id: index + 1,
  name: recipe.name,
  cuisine: recipe.cuisine,
  minutes: recipe.minutes,
  image: recipe.image ?? '',
  calories: recipe.calories ?? 0,
  servings: recipe.servings ?? 4,
  ingredients: withIds(index + 1, recipe.ingredients),
}))

const totalCost = (ingredients) =>
  ingredients.reduce((sum, item) => sum + Number(item.estimated_cost), 0)

// Supabase returns { data, error } instead of throwing; the screens expect a
// thrown Error with a readable message, like the other two backends.
function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('You are signed out. Log in again.')
  return id
}

const bundledById = (id) => bundledRecipes.find((recipe) => String(recipe.id) === String(id))

const RECIPE_COLUMNS = 'id, name, cuisine, minutes, calories, image, servings, ingredients'

// A row of user_recipes in the same shape as a bundled recipe. custom marks
// it as the user's own, which is what lets the screens offer Delete.
const fromRow = (row) => ({
  id: row.id,
  name: row.name,
  cuisine: row.cuisine,
  minutes: row.minutes,
  image: row.image ?? '',
  calories: row.calories ?? 0,
  servings: row.servings ?? 4,
  custom: true,
  ingredients: withIds(row.id, row.ingredients ?? []),
})

async function loadOwnRecipes() {
  const rows = unwrap(
    await supabase.from('user_recipes').select(RECIPE_COLUMNS).order('created_at')
  )
  return rows.map(fromRow)
}

async function getOwnRecipe(id) {
  const row = unwrap(
    await supabase.from('user_recipes').select(RECIPE_COLUMNS).eq('id', id).maybeSingle()
  )
  if (!row) throw new Error('Not found')
  return fromRow(row)
}

// The bundled recipe, with this user's saved ingredients (and servings) in
// place of the defaults if they have edited it.
const applyEdit = (recipe, edited, servings) =>
  edited
    ? { ...recipe, servings: servings ?? recipe.servings, ingredients: withIds(recipe.id, edited) }
    : recipe

// Every recipe the user has edited, as Map(recipe_id -> ingredients).
async function loadEdits() {
  const rows = unwrap(await supabase.from('recipe_ingredients').select('recipe_id, ingredients'))
  return new Map(rows.map((row) => [row.recipe_id, row.ingredients]))
}

// Bundled recipes (with the user's edits), then the user's own.
async function recipesWithEdits() {
  const [edits, own] = await Promise.all([loadEdits(), loadOwnRecipes()])
  return [...bundledRecipes.map((recipe) => applyEdit(recipe, edits.get(recipe.id))), ...own]
}

export async function listRecipes() {
  const recipes = await recipesWithEdits()
  return recipes.map(({ ingredients, ...recipe }) => ({
    ...recipe,
    ingredient_count: ingredients.length,
    total_cost: totalCost(ingredients),
  }))
}

export async function getRecipe(id) {
  const recipe = bundledById(id)
  if (!recipe) return getOwnRecipe(id)
  const row = unwrap(
    await supabase
      .from('recipe_ingredients')
      .select('ingredients, servings')
      .eq('recipe_id', recipe.id)
      .maybeSingle()
  )
  return applyEdit(recipe, row?.ingredients, row?.servings)
}

// servings: how many people these amounts are for (optional, kept if left out)
export async function updateRecipeIngredients(id, ingredients, servings) {
  const cleaned = ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: Number(ingredient.quantity),
    unit: ingredient.unit,
    estimated_cost: Number(ingredient.estimated_cost),
  }))

  const recipe = bundledById(id)
  if (!recipe) {
    // The user's own recipe keeps its ingredients in its own row.
    const rows = unwrap(
      await supabase
        .from('user_recipes')
        .update(servings ? { ingredients: cleaned, servings } : { ingredients: cleaned })
        .eq('id', id)
        .select(RECIPE_COLUMNS)
    )
    if (rows.length === 0) throw new Error('Not found')
    return fromRow(rows[0])
  }

  unwrap(
    await supabase.from('recipe_ingredients').upsert({
      user_id: await currentUserId(),
      recipe_id: recipe.id,
      ingredients: cleaned,
      servings: servings ?? null,
      updated_at: new Date().toISOString(),
    })
  )
  return applyEdit(recipe, cleaned, servings)
}

async function planRows(weekStart) {
  return unwrap(
    await supabase
      .from('meal_plan')
      .select('id, recipe_id, week_start, day, added_at')
      .eq('week_start', weekStart)
  )
}

export async function listMealPlan(weekStart) {
  const [rows, recipes] = await Promise.all([planRows(weekStart), recipesWithEdits()])
  return rows
    .map((entry) => {
      const recipe = recipes.find((row) => row.id === entry.recipe_id)
      return recipe && {
        ...entry,
        recipe_name: recipe.name,
        image: recipe.image,
        calories: recipe.calories,
        total_cost: totalCost(recipe.ingredients),
      }
    })
    // A recipe removed from recipes.js, or deleted, drops out instead of crashing.
    .filter(Boolean)
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.id - b.id)
}

// recipe: { name, cuisine, minutes, calories, image }. Starts with no
// ingredients; the edit screen fills them in.
export async function createRecipe({ name, cuisine, minutes, calories, image }) {
  const row = unwrap(
    await supabase
      .from('user_recipes')
      .insert({
        user_id: await currentUserId(),
        name: name.trim(),
        cuisine,
        minutes: Number(minutes),
        calories: Number(calories) || 0,
        image: (image ?? '').trim(),
      })
      .select(RECIPE_COLUMNS)
      .single()
  )
  return fromRow(row)
}

// Only the user's own recipes can be deleted. It leaves their plan too;
// meal_plan has no foreign key to user_recipes, so that is done here.
export async function deleteRecipe(id) {
  if (bundledById(id)) throw new Error('Only recipes you added can be deleted')
  unwrap(await supabase.from('meal_plan').delete().eq('recipe_id', id))
  const deleted = unwrap(await supabase.from('user_recipes').delete().eq('id', id).select('id'))
  if (deleted.length === 0) throw new Error('Not found')
  return null
}

export async function addToMealPlan({ recipe_id, day, week_start }) {
  const recipe = bundledById(recipe_id) ?? (await getOwnRecipe(recipe_id).catch(() => null))
  if (!recipe) throw new Error('No such recipe')
  if (!DAYS.includes(day)) throw new Error(`day must be one of ${DAYS.join(', ')}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start ?? '')) {
    throw new Error('week must be a Monday, written YYYY-MM-DD')
  }

  const entry = { user_id: await currentUserId(), recipe_id: recipe.id, week_start, day }
  const { data, error } = await supabase.from('meal_plan').insert(entry).select().single()
  // Same rule as the database: one entry per recipe per day, per week. Adding
  // it again is not an error; it returns the one already there.
  if (error?.code === '23505') {
    return unwrap(
      await supabase
        .from('meal_plan')
        .select()
        .match({ recipe_id: recipe.id, week_start, day })
        .single()
    )
  }
  return unwrap({ data, error })
}

export async function removeFromMealPlan(id) {
  const deleted = unwrap(await supabase.from('meal_plan').delete().eq('id', id).select('id'))
  if (deleted.length === 0) throw new Error('Not found')
  return null
}

const ITEM_COLUMNS = 'id, name, quantity, unit, estimated_cost'

export async function getShoppingList(weekStart) {
  const [rows, recipes, checks, added, quantities] = await Promise.all([
    planRows(weekStart),
    recipesWithEdits(),
    supabase.from('shopping_checks').select('item_key').eq('week_start', weekStart).then(unwrap),
    supabase
      .from('shopping_items')
      .select(ITEM_COLUMNS)
      .eq('week_start', weekStart)
      .order('added_at')
      .then(unwrap),
    supabase
      .from('shopping_quantities')
      .select('item_key, quantity')
      .eq('week_start', weekStart)
      .then(unwrap),
  ])
  const lines = rows.flatMap((entry) => {
    const recipe = recipes.find((row) => row.id === entry.recipe_id)
    if (!recipe) return []
    return recipe.ingredients.map((ingredient) => ({ ...ingredient, recipe_name: recipe.name }))
  })
  return buildShoppingList(
    lines,
    checks.map((row) => row.item_key),
    added,
    Object.fromEntries(quantities.map((row) => [row.item_key, Number(row.quantity)]))
  )
}

// quantity is in the line's buying unit (see server/db/shoppingList.js);
// null goes back to the list's own suggestion.
export async function setShoppingItemQuantity({ week_start, item_key, quantity }) {
  if (quantity == null) {
    unwrap(await supabase.from('shopping_quantities').delete().match({ week_start, item_key }))
  } else {
    unwrap(
      await supabase.from('shopping_quantities').upsert({
        user_id: await currentUserId(),
        week_start,
        item_key,
        quantity: Number(quantity),
      })
    )
  }
  return { week_start, item_key, quantity }
}

// item: { week_start, name, quantity, unit }. Returns the new list line.
// The cost is the app's: store catalog prices when the name is a known
// product, otherwise an AI estimate, saved with the item. If the AI is not
// available the item is still added, without a price.
export async function addShoppingItem({ week_start, name, quantity, unit }) {
  const item = { name: name.trim(), quantity: Number(quantity), unit: (unit ?? '').trim() }
  let estimated_cost = 0
  if (AI_ENABLED && !catalogPrices(item.name, item.quantity, item.unit)) {
    estimated_cost = await estimateItemCost(item).catch(() => 0)
  }
  const row = unwrap(
    await supabase
      .from('shopping_items')
      .insert({ user_id: await currentUserId(), week_start, ...item, estimated_cost })
      .select(ITEM_COLUMNS)
      .single()
  )
  return customItem(row)
}

export async function removeShoppingItem(id) {
  const deleted = unwrap(
    await supabase.from('shopping_items').delete().eq('id', id).select('week_start')
  )
  if (deleted.length === 0) throw new Error('Not found')
  // Its tick, if it had one, would otherwise stay behind in shopping_checks.
  unwrap(
    await supabase
      .from('shopping_checks')
      .delete()
      .match({ week_start: deleted[0].week_start, item_key: `custom:${id}` })
  )
  return null
}

export async function setShoppingItemChecked({ week_start, item_key, checked }) {
  if (checked) {
    unwrap(
      await supabase
        .from('shopping_checks')
        .upsert({ user_id: await currentUserId(), week_start, item_key })
    )
  } else {
    unwrap(await supabase.from('shopping_checks').delete().match({ week_start, item_key }))
  }
  return { week_start, item_key, checked }
}
