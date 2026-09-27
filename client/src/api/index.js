import * as mockApi from './mockApi.js'
import * as httpApi from './httpApi.js'
import * as supabaseApi from './supabaseApi.js'
import { SUPABASE_ENABLED } from '../supabase.js'

export const USING_SUPABASE = SUPABASE_ENABLED
export const USING_MOCK_API = !USING_SUPABASE && import.meta.env.VITE_USE_MOCK_API !== 'false'
const implementation = USING_SUPABASE ? supabaseApi : USING_MOCK_API ? mockApi : httpApi
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
