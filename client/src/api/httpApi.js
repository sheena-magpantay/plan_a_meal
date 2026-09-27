// The real client. Every function here talks to YOUR Express API.
//
// This is the file that matters for your finals project. mockApi.js exists so
// you can build the interface before this has anywhere to point.const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
    }
    throw new Error(message)
  }
  return response.status === 204 ? null : response.json()
}

export const listRecipes = () => request('/api/recipes')
export const getRecipe = (id) => request(`/api/recipes/${id}`)
export const createRecipe = (recipe) => request('/api/recipes', { method: 'POST', body: JSON.stringify(recipe) })
export const deleteRecipe = (id) => request(`/api/recipes/${id}`, { method: 'DELETE' })
export const updateRecipeIngredients = (id, ingredients, servings) =>
  request(`/api/recipes/${id}/ingredients`, {
    method: 'PUT',
    body: JSON.stringify({ ingredients, servings }),
  })
export const listMealPlan = (weekStart) => request(`/api/meal-plan?week=${encodeURIComponent(weekStart)}`)
export const addToMealPlan = (entry) => request('/api/meal-plan', { method: 'POST', body: JSON.stringify(entry) })
export const removeFromMealPlan = (id) => request(`/api/meal-plan/${id}`, { method: 'DELETE' })
export const getShoppingList = (weekStart) => request(`/api/shopping-list?week=${encodeURIComponent(weekStart)}`)
export const setShoppingItemQuantity = (change) => request('/api/shopping-list/quantities', { method: 'PUT', body: JSON.stringify(change) })
export const setShoppingItemChecked = (check) => request('/api/shopping-list/checks', { method: 'PUT', body: JSON.stringify(check) })
export const addShoppingItem = (item) => request('/api/shopping-list/items', { method: 'POST', body: JSON.stringify(item) })
export const removeShoppingItem = (id) => request(`/api/shopping-list/items/${id}`, { method: 'DELETE' })
