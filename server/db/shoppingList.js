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
const singular = (name) =>
  name.endsWith('oes') ? name.slice(0, -2) : name.endsWith('s') ? name.slice(0, -1) : name

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
  if (count === 1 || word === 'pc' || word.endsWith('dozen')) return word
  if (word === 'loaf') return 'loaves'
  return /(ch|sh|x|s)$/.test(word) ? `${word}es` : `${word}s`
}

function formatMeasure(value, unit) {
  if (unit === 'g') return value >= 1000 ? `${round(value / 1000)} kg` : `${Math.round(value)} g`
  if (unit === 'ml') return value >= 1000 ? `${round(value / 1000)} L` : `${Math.round(value)} ml`
  const count = Math.ceil(value - EPSILON)
  return `${count} ${plural(unit, count)}`
}

function cheapestMix(options, need) {
  const target = Math.max(1, Math.ceil(need - EPSILON))
  let best = null
  const tryFrom = (index, counts, pieces, cost) => {
    if (pieces >= target) {
      const packages = counts.reduce((sum, count) => sum + count, 0)
      if (!best || cost < best.cost || (cost === best.cost && packages < best.packages)) {
        best = { counts: [...counts], pieces, cost, packages }
      }
      return
    }
    if (index === options.length) return
    const { size, price } = options[index]
    const most = Math.ceil((target - pieces) / size)
    for (let count = 0; count <= most; count++) {
      counts[index] = count
      tryFrom(index + 1, counts, pieces + count * size, cost + count * price)
    }
    counts[index] = 0
  }
  tryFrom(0, options.map(() => 0), 0, 0)
  return best
}

const stepOf = (product) =>
  product.step ?? (product.unit === 'g' ? 50 : product.unit === 'ml' ? 100 : 1)

function buyingDefault(product, need) {
  if (product.kind === 'pack') {
    return { quantity: Math.max(1, Math.ceil(need / product.size - EPSILON)), step: 1 }
  }
  if (product.kind === 'sizes') {
    const step = Math.min(...product.options.map((option) => option.size))
    return { quantity: cheapestMix(product.options, need).pieces, step }
  }
  const step = stepOf(product)
  const amount = Math.max(step, Math.ceil(need / step - EPSILON) * step)
  if (product.unit === 'pc') return { quantity: amount, step }
  return { quantity: amount / 1000, step: step / 1000 } // grams -> kg, ml -> L
}

function buyingUnit(product, quantity) {
  if (product.kind === 'pack') return plural(product.sold, quantity)
  if (product.kind === 'sizes') return plural(product.label, quantity)
  if (product.unit === 'pc') return plural(product.label ?? 'pc', quantity)
  return product.unit === 'g' ? 'kg' : 'L'
}

function priceAt(product, quantity) {
  if (product.kind === 'sizes') {
    const mix = cheapestMix(product.options, quantity)
    const amount = product.options
      .map((option, index) => ({ ...option, count: mix.counts[index] }))
      .filter((option) => option.count > 0)
      .sort((a, b) => b.size - a.size)
      .map(({ sold, size, count }) =>
        size > 1
          ? `${count} ${plural(sold, count)} (${size} ${plural(product.label, size)}${count > 1 ? ' each' : ''})`
          : `${count} ${plural(sold, count)}`
      )
      .join(' + ')
    return { amount, cost: mix.cost, holds: mix.pieces }
  }

  if (product.kind === 'pack') {
    const count = Math.max(1, Math.round(quantity))
    const size = formatMeasure(product.size, product.unit)
    return {
      amount: `${count} ${plural(product.sold, count)} (${size}${count > 1 ? ' each' : ''})`,
      cost: count * product.price,
      holds: count * product.size,
    }
  }

  if (product.unit === 'pc') {
    const count = Math.max(1, Math.round(quantity))
    const label = product.label ?? 'pc'
    return { amount: `${count} ${plural(label, count)}`, cost: count * product.price, holds: count }
  }

  const base = quantity * 1000
  return {
    amount: formatMeasure(base, product.unit),
    cost: round(quantity * product.price),
    holds: base,
  }
}

function describeNeed(product, need) {
  if (product.unit === 'pc' && product.kind !== 'pack') {
    const count = Math.ceil(need - EPSILON)
    return `${count} ${plural(product.label ?? 'pc', count)}`
  }
  return formatMeasure(need, product.unit)
}

function usesNote(product, need, holds) {
  if (holds < need - EPSILON) return `recipes need ${describeNeed(product, need)}`
  if (product.kind === 'pack' && need < holds - EPSILON) {
    return `uses about ${formatMeasure(need, product.unit)}`
  }
  if (product.kind === 'sizes') {
    const used = Math.ceil(need - EPSILON)
    if (used < holds) return `uses ${used} of ${holds} ${plural(product.label, holds)}`
  }
  return ''
}

function productLine(product, need, chosen) {
  const { quantity: suggested, step } = buyingDefault(product, need)
  const quantity = chosen > 0 ? chosen : suggested
  const { amount, cost, holds } = priceAt(product, quantity)
  return {
    amount,
    uses: usesNote(product, need, holds),
    cost,
    quantity,
    unit: buyingUnit(product, quantity),
    step,
    suggested_quantity: suggested,
  }
}

function unknownLine(group, chosen) {
  const byMeasure = group.base === 'g' || group.base === 'ml'
  const suggested = byMeasure ? Math.max(1, Math.round(group.need)) : Math.ceil(group.need - EPSILON)
  const quantity = chosen > 0 ? chosen : suggested
  const perUnit = group.need > 0 ? group.estimated_cost / group.need : 0
  return {
    amount: formatMeasure(quantity, group.base),
    uses: quantity < group.need - EPSILON
      ? `recipes need ${formatMeasure(group.need, group.base)}`
      : '',
    cost: group.need > 0 ? perUnit * quantity : group.estimated_cost,
    priced: group.estimated_cost > 0,
    quantity,
    unit: group.base === 'pc' ? 'pc' : byMeasure ? group.base : plural(group.base, quantity),
    step: byMeasure ? 10 : 1,
    suggested_quantity: suggested,
  }
}

export const isSpoonMeasure = (unit) => ['cup', 'tbsp', 'tsp'].includes(normalizeUnit(unit ?? ''))
export function ingredientCost(name, quantity, unit) {
  if (isSpoonMeasure(unit)) return 0
  const product = findProduct(name)
  const amount = product ? toProductUnit(product, Number(quantity), normalizeUnit(unit ?? '')) : null
  if (amount == null || !(amount > 0)) return null
  if (product.kind === 'pack') return round((amount * product.price) / product.size)
  if (product.kind === 'sizes') {
    const perPiece = Math.min(...product.options.map((option) => option.price / option.size))
    return round(amount * perPiece)
  }
  if (product.unit === 'pc') return round(amount * product.price)
  return round((amount / 1000) * product.price)
}

function handAddedNeed(product, quantity, unit) {
  const need = toProductUnit(product, quantity, unit)
  if (need != null || unit !== 'pc') return need
  return product.kind === 'pack' ? quantity * product.size : null
}

export function catalogPrices(name, quantity, unit) {
  const product = findProduct(name)
  return Boolean(product && handAddedNeed(product, Number(quantity), normalizeUnit(unit ?? '')) != null)
}

export function customItem(row, checkedKeys = [], chosen) {
  const key = `custom:${row.id}`
  const quantity = Number(row.quantity) > 0 ? Number(row.quantity) : 1
  const unit = normalizeUnit(row.unit ?? '')
  const product = findProduct(row.name)
  const need = product ? handAddedNeed(product, quantity, unit) : null
  const estimate = Number(row.estimated_cost) || 0

  let bought
  if (need != null) {
    bought = productLine(product, need, chosen)
  } else {
    const base = unit in MASS ? 'g' : unit in VOLUME ? 'ml' : unit
    const factor = unit in MASS ? MASS[unit] : unit in VOLUME ? VOLUME[unit] : 1
    bought = unknownLine({ need: quantity * factor, base, estimated_cost: estimate }, chosen)
  }

  return {
    key,
    id: row.id,
    custom: true,
    name: row.name,
    category: need != null ? product.category : null,
    amount: bought.amount,
    uses: '',
    estimated_cost: round(bought.cost),
    priced: need != null || estimate > 0,
    recipes: [],
    checked: checkedKeys.includes(key),
    quantity: round(bought.quantity, 3),
    unit: bought.unit,
    step: bought.step,
    suggested_quantity: round(bought.suggested_quantity, 3),
    edited: chosen !== undefined,
  }
}

export function buildShoppingList(lines, checkedKeys, customRows = [], quantities = {}) {
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
    const base = unit in MASS ? 'g' : unit in VOLUME ? 'ml' : unit
    const factor = unit in MASS ? MASS[unit] : unit in VOLUME ? VOLUME[unit] : 1
    const name = singular(normalizeName(line.name))
    addTo(`${name}|${base}`, { name: line.name.trim(), base }, line, quantity * factor)
  }

  const checked = new Set(checkedKeys)
  return [...groups.entries()]
    .map(([key, group]) => {
      const chosen = Number(quantities[key]) || undefined
      const bought = group.product
        ? productLine(group.product, group.need, chosen)
        : unknownLine(group, chosen)
      return {
        key,
        name: group.name,
        category: group.product?.category ?? null,
        amount: bought.amount,
        uses: bought.uses,
        estimated_cost: round(bought.cost),
        priced: bought.priced ?? true,
        recipes: group.recipes,
        checked: checked.has(key),
        quantity: round(bought.quantity, 3),
        unit: bought.unit,
        step: bought.step,
        suggested_quantity: round(bought.suggested_quantity, 3),
        edited: chosen !== undefined,
      }
    })
    .concat(
      customRows.map((row) =>
        customItem(row, checkedKeys, Number(quantities[`custom:${row.id}`]) || undefined)
      )
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}
