// Turns the ingredient lines of every recipe planned for a week into one
// shopping list. The same ingredient in the same unit is combined across
// recipes: two recipes each needing 1 pc Onion become one line of 2 pc Onion.
// Different units stay separate (1 head Garlic and 3 clove Garlic), because
// they cannot be added up.
//
// Pure JavaScript with no database access, so recipesRepo.js and the client's
// demo mode (client/src/api/mockApi.js) build the list the same way.

// Identifies a shopping list line. Also what a ticked checkbox is saved under.
export function itemKey(name, unit) {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`
}

// Adding decimals leaves float noise (0.1 + 0.2); two places is plenty here.
const round = (value) => Math.round(value * 100) / 100

// lines: [{ name, quantity, unit, estimated_cost, recipe_name }]
// checkedKeys: the item keys ticked for this week
export function buildShoppingList(lines, checkedKeys) {
  const items = new Map()

  for (const line of lines) {
    const key = itemKey(line.name, line.unit)
    const item = items.get(key) ?? {
      key,
      name: line.name.trim(),
      unit: line.unit.trim(),
      quantity: 0,
      estimated_cost: 0,
      recipes: [],
    }
    item.quantity += Number(line.quantity)
    item.estimated_cost += Number(line.estimated_cost)
    if (!item.recipes.includes(line.recipe_name)) item.recipes.push(line.recipe_name)
    items.set(key, item)
  }

  const checked = new Set(checkedKeys)
  return [...items.values()]
    .map((item) => ({
      ...item,
      quantity: round(item.quantity),
      estimated_cost: round(item.estimated_cost),
      checked: checked.has(item.key),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
