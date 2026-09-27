import * as httpApi from './httpApi.js'
import * as supabaseApi from './supabaseApi.js'
import { SUPABASE_ENABLED } from '../supabase.js'

export const USING_SUPABASE = SUPABASE_ENABLED
const implementation = USING_SUPABASE ? supabaseApi : httpApi
export const {
  listRecipes,
  getRecipe,
  createRecipe,
  deleteRecipe,
  updateRecipeIngredients,
  listMealPlan,
  addToMealPlan,
  removeFromMealPlan,
  getShoppingList,
  setShoppingItemChecked,
  setShoppingItemQuantity,
  addShoppingItem,
  removeShoppingItem,
} = implementation
