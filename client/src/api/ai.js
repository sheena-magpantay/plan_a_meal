import { supabase, SUPABASE_ENABLED } from '../supabase.js'

export const AI_ENABLED = SUPABASE_ENABLED
export const generateRecipe = (prompt) => call({ prompt })

export async function estimateItemCost(item) {
  const { estimated_cost } = await call({ task: 'price', item })
  return Number(estimated_cost) || 0
}

export async function planWeek({ recipes, days, prompt }) {
  const { plan } = await call({ task: 'plan', recipes, days, prompt })
  return Array.isArray(plan) ? plan : []
}

async function call(body) {
  const { data, error } = await supabase.functions.invoke('generate-recipe', { body })
  if (error) {
    let body = null
    try {
      body = await error.context?.json()
    } catch {
    }
    if (typeof body?.error === 'string') throw new Error(body.error)
    const status = error.context?.status
    if (!status || status === 404) {
      throw new Error('The AI recipe service is not set up yet (see supabase/functions/README.md).')
    }
    throw new Error(`The AI request failed (${status}). Try again.`)
  }
  return data
}
