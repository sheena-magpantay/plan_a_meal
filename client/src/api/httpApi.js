// The real client. Every function here talks to YOUR Express API.
//
// This is the file that matters for your finals project. mockApi.js exists so
// you can build the interface before this has anywhere to point.

const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    // Try to use the API's own message; fall back to the status line.
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // The body was not JSON. The status line is all we have.
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

export const listRecipes = () => request('/api/recipes')

export const getRecipe = (id) => request(`/api/recipes/${id}`)

export const updateRecipeIngredients = (id, ingredients) =>
  request(`/api/recipes/${id}/ingredients`, {
    method: 'PUT',
    body: JSON.stringify({ ingredients }),
  })

// weekStart is that week's Monday as YYYY-MM-DD (see src/week.js).
export const listMealPlan = (weekStart) =>
  request(`/api/meal-plan?week=${encodeURIComponent(weekStart)}`)

// entry: { recipe_id, day, week_start }
export const addToMealPlan = (entry) =>
  request('/api/meal-plan', { method: 'POST', body: JSON.stringify(entry) })

export const removeFromMealPlan = (id) =>
  request(`/api/meal-plan/${id}`, { method: 'DELETE' })

export const getShoppingList = (weekStart) =>
  request(`/api/shopping-list?week=${encodeURIComponent(weekStart)}`)

// check: { week_start, item_key, checked }
export const setShoppingItemChecked = (check) =>
  request('/api/shopping-list/checks', { method: 'PUT', body: JSON.stringify(check) })

// item: { week_start, name, amount, estimated_cost }
export const addShoppingItem = (item) =>
  request('/api/shopping-list/items', { method: 'POST', body: JSON.stringify(item) })

export const removeShoppingItem = (id) =>
  request(`/api/shopping-list/items/${id}`, { method: 'DELETE' })
