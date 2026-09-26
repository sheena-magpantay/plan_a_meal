// Ingredient costs, worked out by the app rather than typed in.
//
// First choice is the store catalog (server/db/storeProducts.js): typical
// Philippine supermarket and palengke prices, charged for the share a recipe
// uses. For anything the catalog does not know, the AI estimates that amount
// (Supabase only, see supabase/functions/generate-recipe).

import { ingredientCost, isSpoonMeasure } from '../../server/db/shoppingList.js'
import { AI_ENABLED, estimateItemCost } from './api/ai.js'

// Cups and spoons get no cost (see isSpoonMeasure in shoppingList.js).
export { isSpoonMeasure }

// Instant, from the catalog. null when the catalog does not know it.
export const storeCost = (name, quantity, unit) => ingredientCost(name, quantity, unit)

// Resolves to a cost in pesos, or null when nothing could price it.
export async function priceIngredient({ name, quantity, unit }) {
  if (isSpoonMeasure(unit)) return 0
  const fromStore = storeCost(name, quantity, unit)
  if (fromStore != null) return fromStore
  if (!AI_ENABLED) return null
  try {
    const cost = await estimateItemCost({ name, quantity, unit, portion: true })
    return cost > 0 ? cost : null
  } catch {
    return null
  }
}
