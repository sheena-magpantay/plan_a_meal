// AI recipe suggestions, from the generate-recipe Edge Function
// (supabase/functions/generate-recipe). The Gemini key lives there, as a
// Supabase secret, never in this code.
//
// Only available with Supabase: demo mode and the Express API have no
// function to call, so the screens hide the AI box when AI_ENABLED is false.

import { supabase, SUPABASE_ENABLED } from '../supabase.js'

export const AI_ENABLED = SUPABASE_ENABLED

// Resolves to { name, cuisine, minutes, calories, ingredients }. Prices in
// the ingredients are Gemini's estimates.
export const generateRecipe = (prompt) => call({ prompt })

// item: { name, quantity, unit, portion? }. Resolves to Gemini's estimate in
// pesos of what that amount costs in a Philippine supermarket; with portion:
// true, the cost of just the amount a recipe uses rather than a whole package.
export async function estimateItemCost(item) {
  const { estimated_cost } = await call({ task: 'price', item })
  return Number(estimated_cost) || 0
}

async function call(body) {
  const { data, error } = await supabase.functions.invoke('generate-recipe', { body })
  if (error) {
    // The function answers errors with { error: "..." }; show that message
    // rather than supabase-js's generic "non-2xx status code".
    let body = null
    try {
      body = await error.context?.json()
    } catch {
      // Not JSON; fall through to the messages below.
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
