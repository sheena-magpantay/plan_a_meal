export const costToBuy = (items) =>
  items.filter((item) => !item.checked).reduce((sum, item) => sum + item.estimated_cost, 0);
