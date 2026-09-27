import { ingredientCost, isSpoonMeasure } from '../../server/db/shoppingList.js'
import { AI_ENABLED, estimateItemCost } from './api/ai.js'

export { isSpoonMeasure }
export const storeCost = (name, quantity, unit) => ingredientCost(name, quantity, unit)

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
