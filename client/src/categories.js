const RULES = [
  [
    "Pantry",
    [
      "sauce", "paste", "stock", "oil", "vinegar", "sugar", "salt", "flour", "cornstarch",
      "powder", "spice", "peppercorn", "white pepper", "ground black pepper", "star anise",
      "bay leaves", "dried", "kasubha", "wine", "honey", "ketchup", "dressing", "mix",
      "noodles", "spaghetti", "fettuccine", "macaroni", "rice", "wrappers", "bread",
      "breadcrumbs", "buns", "croutons", "peanut", "cashew", "nuts", "raisins",
      "coconut milk", "coconut cream", "crushed tomatoes", "pineapple", "bamboo shoots",
      "liver spread", "bagoong", "doubanjiang", "water",
    ],
  ],
  [
    "Protein",
    [
      "chicken", "pork", "beef", "oxtail", "bacon", "fish", "lapu-lapu", "salmon", "dory",
      "shrimp", "tofu", "lamb", "char siu", "liver",
    ],
  ],
  ["Dairy & Eggs", ["egg", "milk", "butter", "cheese", "cheddar", "parmesan", "cream"]],
  [
    "Produce",
    [
      "onion", "garlic", "ginger", "tomato", "carrot", "potato", "cabbage", "pechay",
      "kangkong", "radish", "beans", "eggplant", "papaya", "chili", "siling", "leaves",
      "squash", "ampalaya", "okra", "bell pepper", "broccoli", "lettuce", "celery",
      "asparagus", "lemon", "calamansi", "chives", "mushrooms", "sprouts", "peas",
      "rosemary",
    ],
  ],
];

export const CATEGORY_ORDER = ["Pantry", "Protein", "Produce", "Dairy & Eggs", "Other"];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = RULES.map(([category, words]) => [
  category,
  new RegExp(`\\b(${words.map(escape).join("|")})(s|es)?\\b`, "i"),
]);

export function categorize(name) {
  const match = MATCHERS.find(([, pattern]) => pattern.test(name));
  return match ? match[0] : "Other";
}
