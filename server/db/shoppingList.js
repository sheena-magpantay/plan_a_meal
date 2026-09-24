// Turns the ingredient lines of every recipe planned for a week into one
// shopping list of things you can buy in a Philippine supermarket.
//
// Each ingredient is matched to a store product (db/storeProducts.js), its
// recipe amounts are converted into that product's unit and added up, and the
// total is rounded up to what the store sells. "0.5 cup + 3 tbsp" of soy sauce
// from two recipes becomes one line: 1 bottle (385 ml). Onion and Onions, or
// Garlic by the head and by the clove, end up on the same line.
//
// The cost is what those packages cost, not the recipes' estimated share.
// Ingredients the catalog does not know (anything typed on the edit screen)
// are still merged by name, with cups and spoons turned into ml, and keep the
// recipes' estimated cost.
//
// Pure JavaScript with no database access, so recipesRepo.js and the client's
// demo mode (client/src/api/mockApi.js) build the list the same way.

import { PRODUCTS } from './storeProducts.js'

const MASS = { g: 1, kg: 1000 }
const VOLUME = { ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5 }

// Units as people type them, reduced to one spelling each.
const UNIT_ALIASES = {
  '': 'pc', piece: 'pc', pieces: 'pc', pcs: 'pc', pc: 'pc',
  gram: 'g', grams: 'g', g: 'g', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml', liter: 'l', liters: 'l', litre: 'l', litres: 'l', l: 'l',
  cup: 'cup', cups: 'cup', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbsp: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  cloves: 'clove', heads: 'head', bunches: 'bunch', cans: 'can', packs: 'pack',
  stalks: 'stalk', slices: 'slice',
}
const normalizeUnit = (unit) => {
  const key = unit.trim().toLowerCase().replace(/\.$/, '')
  return UNIT_ALIASES[key] ?? key
}

const normalizeName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ')

// "tomatoes" -> "tomato", "onions" -> "onion"; used when an exact name is not
// in the catalog.
const singular = (name) =>
  name.endsWith('oes') ? name.slice(0, -2) : name.endsWith('s') ? name.slice(0, -1) : name

// name -> product, with any alias-specific overrides already applied
const CATALOG = new Map()
for (const product of PRODUCTS) {
  CATALOG.set(normalizeName(product.name), product)
  for (const alias of product.also ?? []) {
    const [name, overrides] = Array.isArray(alias) ? alias : [alias, null]
    CATALOG.set(normalizeName(name), overrides ? { ...product, ...overrides } : product)
  }
}

function findProduct(name) {
  const key = normalizeName(name)
  return CATALOG.get(key) ?? CATALOG.get(singular(key)) ?? null
}

// Converts one recipe amount into the product's unit, or null if it cannot.
function toProductUnit(product, quantity, unit) {
  if (product.per?.[unit] != null) return quantity * product.per[unit]
  if (unit in MASS) {
    const grams = quantity * MASS[unit]
    if (product.unit === 'g') return grams
    if (product.perG) return grams * product.perG
  }
  if (unit in VOLUME) {
    const ml = quantity * VOLUME[unit]
    if (product.unit === 'ml') return ml
    if (product.perMl) return ml * product.perMl
  }
  if (product.kind === 'pack' && unit === product.sold) return quantity * product.size
  if (product.unit === 'pc' && (unit === 'pc' || unit === product.label)) return quantity
  return null
}

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const EPSILON = 1e-9

function plural(word, count) {
  if (count === 1 || word === 'pc') return word
  if (word === 'loaf') return 'loaves'
  return /(ch|sh|x|s)$/.test(word) ? `${word}es` : `${word}s`
}

// 1500 g -> "1.5 kg", 385 ml -> "385 ml", 3.8 pc -> "4 pc" (you use whole pieces)
function formatMeasure(value, unit) {
  if (unit === 'g') return value >= 1000 ? `${round(value / 1000)} kg` : `${Math.round(value)} g`
  if (unit === 'ml') return value >= 1000 ? `${round(value / 1000)} L` : `${Math.round(value)} ml`
  return `${Math.ceil(value - EPSILON)} ${unit}`
}

// What to put in the basket, its cost, and (for packages) how much the
// recipes actually use.
function purchase(product, need) {
  if (product.kind === 'pack') {
    const count = Math.max(1, Math.ceil(need / product.size - EPSILON))
    const size = formatMeasure(product.size, product.unit)
    const amount = `${count} ${plural(product.sold, count)} (${size}${count > 1 ? ' each' : ''})`
    const uses = need < count * product.size - EPSILON
      ? `uses about ${formatMeasure(need, product.unit)}`
      : ''
    return { amount, uses, cost: count * product.price }
  }

  const step = product.step ?? (product.unit === 'g' ? 50 : product.unit === 'ml' ? 100 : 1)
  const quantity = Math.max(step, Math.ceil(need / step - EPSILON) * step)
  if (product.unit === 'pc') {
    const label = product.label ?? 'pc'
    return { amount: `${quantity} ${plural(label, quantity)}`, uses: '', cost: quantity * product.price }
  }
  // Loose weight or volume is priced per kg or per litre.
  return {
    amount: formatMeasure(quantity, product.unit),
    uses: '',
    cost: round((quantity / 1000) * product.price),
  }
}

// lines: [{ name, quantity, unit, estimated_cost, recipe_name }]
// checkedKeys: the item keys ticked for this week
export function buildShoppingList(lines, checkedKeys) {
  const groups = new Map()

  const addTo = (key, start, line, amount) => {
    const group = groups.get(key) ?? { ...start, need: 0, estimated_cost: 0, recipes: [] }
    group.need += amount
    group.estimated_cost += Number(line.estimated_cost)
    if (!group.recipes.includes(line.recipe_name)) group.recipes.push(line.recipe_name)
    groups.set(key, group)
  }

  for (const line of lines) {
    const quantity = Number(line.quantity)
    const unit = normalizeUnit(line.unit ?? '')
    const product = findProduct(line.name)
    const inProductUnit = product ? toProductUnit(product, quantity, unit) : null

    if (inProductUnit != null) {
      addTo(`product:${normalizeName(product.name)}`, { product, name: product.name }, line, inProductUnit)
      continue
    }

    // Not in the catalog: merge by name and measure. Cups and spoons become
    // ml and kg becomes g, so a store-friendly unit is shown.
    const base = unit in MASS ? 'g' : unit in VOLUME ? 'ml' : unit
    const factor = unit in MASS ? MASS[unit] : unit in VOLUME ? VOLUME[unit] : 1
    const name = singular(normalizeName(line.name))
    addTo(`${name}|${base}`, { name: line.name.trim(), base }, line, quantity * factor)
  }

  const checked = new Set(checkedKeys)
  return [...groups.entries()]
    .map(([key, group]) => {
      const bought = group.product
        ? purchase(group.product, group.need)
        : { amount: formatMeasure(group.need, group.base), uses: '', cost: group.estimated_cost }
      return {
        key,
        name: group.name,
        category: group.product?.category ?? null,
        amount: bought.amount,
        uses: bought.uses,
        estimated_cost: round(bought.cost),
        recipes: group.recipes,
        checked: checked.has(key),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
