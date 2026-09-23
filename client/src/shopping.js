// What the shopping list still costs: only unticked items count, so it goes
// down as you shop. The Grocery List's "Total cost" and the home screen's
// "Budget this week" both use this, so they always show the same number.
export const costToBuy = (items) =>
  items.filter((item) => !item.checked).reduce((sum, item) => sum + item.estimated_cost, 0);
