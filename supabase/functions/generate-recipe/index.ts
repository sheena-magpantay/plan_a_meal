// Supabase Edge Function: turns a short request ("cheap chicken dinner, 30
// minutes") into a recipe, using Google's Gemini API. It also estimates the
// price of an item the app's store catalog does not know: send
// { task: "price", item: { name, quantity, unit } } for a grocery list item
// (what you pay at the store), or add portion: true for a recipe ingredient
// (the cost of just the amount the recipe uses).
//
// Why this runs here and not in the browser: the Gemini key must stay secret.
// Anything in client/.env is compiled into the public JavaScript. This
// function reads the key from a Supabase secret instead:
//
//   supabase secrets set GEMINI_API_KEY=your-key
//   supabase secrets set GEMINI_MODEL=gemini-3.6-flash   (optional)
//
// Only signed-in users of the app can call it, so strangers cannot spend
// your Gemini quota.
//
// It returns { name, cuisine, minutes, calories, ingredients: [{ name,
// quantity, unit, estimated_cost }] }, the same shape the app's recipes use.
// Prices are Gemini's ESTIMATES in pesos, not live store prices; the app
// shows them on the edit screen for the user to check.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash'
const CUISINES = ['Filipino', 'Chinese', 'Western']
const MAX_PROMPT = 300

// The browser calls this from another origin (your site), so it needs CORS.
// "*" is fine: access is controlled by the user's login token, not cookies.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Gemini's structured output: the reply must be JSON in exactly this shape.
const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    cuisine: { type: 'STRING', enum: CUISINES },
    minutes: { type: 'INTEGER', description: 'Total prep and cooking time in minutes' },
    calories: { type: 'INTEGER', description: 'Estimated calories per serving' },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unit: { type: 'STRING' },
          estimated_cost: {
            type: 'NUMBER',
            description: 'Cost in Philippine pesos for the whole quantity',
          },
        },
        required: ['name', 'quantity', 'unit', 'estimated_cost'],
      },
    },
  },
  required: ['name', 'cuisine', 'minutes', 'calories', 'ingredients'],
}

const INSTRUCTIONS = `You write recipes for a weekly meal planner used by households in the Philippines.
- One recipe for 4 servings, with ingredients you can buy in a Philippine supermarket or palengke.
- cuisine must be Filipino, Chinese or Western, whichever fits best.
- quantity is a number; unit is one of: g, kg, ml, L, cup, tbsp, tsp, pc, clove, head, bunch, can, pack.
- estimated_cost is your best estimate in Philippine pesos of what that quantity costs at a typical Metro Manila supermarket.
- Use plain ingredient names ("Chicken thighs", "Soy sauce"), no brand names or preparation notes.
- If the request is not about food, write a simple, popular Filipino home-cooked dish instead.`

// For { task: "price" }: one number, the cost in pesos.
const PRICE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    estimated_cost: {
      type: 'NUMBER',
      description: 'Cost in Philippine pesos for the whole quantity',
    },
  },
  required: ['estimated_cost'],
}

const PRICE_INSTRUCTIONS = `You estimate grocery prices for households in the Philippines.
Given an item, a quantity and a unit, answer with estimated_cost: what that whole quantity
costs today at a typical Metro Manila supermarket, in Philippine pesos. If no unit is given,
assume pieces. If it is not something sold in a grocery store, answer 0.`

const PORTION_INSTRUCTIONS = `You estimate ingredient costs for recipes cooked by households in the Philippines.
Given an ingredient, a quantity and a unit, answer with estimated_cost: the cost in Philippine
pesos of just that amount, as a share of its typical Metro Manila supermarket or palengke price.
Example: 1 tbsp from a 350 ml bottle of fish sauce that costs ₱40 is about ₱1.70.
If no unit is given, assume pieces. If it is not a food or cooking ingredient, answer 0.`

// Sends one request to Gemini and returns its JSON reply, or a Response to
// send back when Gemini fails.
// temperature: higher for varied recipes, lower for steady price estimates.
async function askGemini(
  apiKey: string,
  instructions: string,
  text: string,
  schema: unknown,
  temperature: number
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature,
        },
      }),
    }
  )

  if (!response.ok) {
    // The detail goes to the function's logs; the user gets a plain message.
    console.error('Gemini error', response.status, await response.text())
    if (response.status === 429) {
      return json({ error: 'The AI is busy right now. Try again in a minute.' }, 429)
    }
    if (response.status === 404) {
      return json({ error: `Gemini model "${MODEL}" was not found. Set GEMINI_MODEL.` }, 502)
    }
    return json({ error: 'The AI could not answer. Try again.' }, 502)
  }

  const result = await response.json()
  const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text
  try {
    return JSON.parse(reply)
  } catch (error) {
    console.error('Unusable Gemini reply', error, reply)
    return json({ error: 'The AI gave an unusable answer. Try again.' }, 502)
  }
}

// Gemini's JSON is trusted only as far as the database's own rules: clean it
// to the same limits as supabase/schema.sql so a bad reply cannot break a save.
function clean(recipe: any) {
  const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
  const whole = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(value))
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  const money = (value: unknown) => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0
  }

  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((item: any) => ({
      name: text(item?.name, 120),
      quantity: Math.round(Number(item?.quantity) * 100) / 100,
      unit: text(item?.unit, 20),
      estimated_cost: money(item?.estimated_cost),
    }))
    .filter((item: any) => item.name && Number.isFinite(item.quantity) && item.quantity > 0)
    .slice(0, 40)

  return {
    name: text(recipe?.name, 120) || 'AI recipe',
    cuisine: CUISINES.includes(recipe?.cuisine) ? recipe.cuisine : 'Filipino',
    minutes: whole(recipe?.minutes, 1, 1440, 30),
    calories: whole(recipe?.calories, 0, 10000, 0),
    ingredients,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  // Signed-in users only. The app sends the user's login token automatically.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
  )
  const { data: auth } = await supabase.auth.getUser(token)
  if (!auth?.user) return json({ error: 'Log in to use the AI.' }, 401)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set on the server.' }, 500)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Send JSON: { "prompt": "..." }' }, 400)
  }

  if (body?.task === 'price') {
    const name = String(body.item?.name ?? '').trim().slice(0, 120)
    const quantity = Number(body.item?.quantity)
    const unit = String(body.item?.unit ?? '').trim().slice(0, 20)
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      return json({ error: 'Send item: { name, quantity, unit }' }, 400)
    }
    const request = `${quantity} ${unit || 'pc'} of ${name}`
    const instructions = body.item?.portion === true ? PORTION_INSTRUCTIONS : PRICE_INSTRUCTIONS
    const reply = await askGemini(apiKey, instructions, request, PRICE_SCHEMA, 0.2)
    if (reply instanceof Response) return reply
    const cost = Number(reply?.estimated_cost)
    const estimated_cost = Number.isFinite(cost) && cost >= 0 ? Math.round(cost * 100) / 100 : 0
    return json({ estimated_cost })
  }

  const prompt = String(body?.prompt ?? '').trim()
  if (!prompt) return json({ error: 'Describe the dish you want.' }, 400)
  if (prompt.length > MAX_PROMPT) {
    return json({ error: `Keep it under ${MAX_PROMPT} characters.` }, 400)
  }

  const reply = await askGemini(apiKey, INSTRUCTIONS, prompt, RECIPE_SCHEMA, 0.8)
  if (reply instanceof Response) return reply
  const recipe = clean(reply)
  if (recipe.ingredients.length === 0) {
    return json({ error: 'The AI gave an unusable answer. Try rewording your request.' }, 502)
  }
  return json(recipe)
})
