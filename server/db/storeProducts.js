// How each ingredient is sold in a Philippine supermarket (SM, Puregold,
// Robinsons), so the shopping list asks for things you can actually buy:
// "1 bottle (385 ml)" of soy sauce, not "0.5 cup + 3 tbsp".
//
// Prices are rough estimates in pesos. Edit them, or add products, freely.
//
// pack(name, category, sold, size, unit, price, options)
//   Sold in fixed packages. `size` is how much one package holds, in `unit`
//   ('g', 'ml' or 'pc'); `price` is per package.
//
// loose(name, category, unit, price, options)
//   Sold by weight or by the piece. `price` is per kg when unit is 'g', per
//   litre for 'ml', and per piece for 'pc'. `step` is the smallest amount you
//   would ask for (default 50 g, 100 ml or 1 piece); `label` names a piece,
//   e.g. 'head' for garlic or 'bunch' for pechay.
//
// sizes(name, category, label, options, extras)
//   Sold only in a few package sizes, counted in pieces: eggs by the dozen or
//   half dozen, instant noodles by the pack or bundle. `label` names one piece
//   ('egg', 'pack'); each option is { sold, size, price } with `size` in
//   pieces. The shopping list buys the cheapest mix that covers what the
//   recipes need.
//
// Options that turn recipe amounts into the product's unit:
//   perMl  how many product units one ml of the recipe amount is
//          (grams per ml for sugar measured in cups; cubes per ml of stock)
//   perG   the same for recipe amounts in grams or kg
//   per    named recipe units, e.g. { clove: 0.1 } (a clove is 0.1 head)
//   also   other ingredient names that mean this product. An entry can be
//          [name, { overrides }] when that name converts differently, like
//          cooked rice, where a cup needs far less raw rice.

const PANTRY = 'Pantry'
const PROTEIN = 'Protein'
const DAIRY = 'Dairy & Eggs'
const PRODUCE = 'Produce'

const pack = (name, category, sold, size, unit, price, options = {}) =>
  ({ name, category, kind: 'pack', sold, size, unit, price, ...options })
const loose = (name, category, unit, price, options = {}) =>
  ({ name, category, kind: 'loose', unit, price, ...options })
const sizes = (name, category, label, options, extras = {}) =>
  ({ name, category, kind: 'sizes', unit: 'pc', label, options, ...extras })

export const PRODUCTS = [
  // Pantry: sauces and condiments
  pack('Soy sauce', PANTRY, 'bottle', 385, 'ml', 38),
  pack('Light soy sauce', PANTRY, 'bottle', 500, 'ml', 95),
  pack('Dark soy sauce', PANTRY, 'bottle', 500, 'ml', 110),
  pack('Cane vinegar', PANTRY, 'bottle', 385, 'ml', 30, { also: ['vinegar', 'white vinegar'] }),
  pack('Rice vinegar', PANTRY, 'bottle', 300, 'ml', 120),
  pack('Black vinegar', PANTRY, 'bottle', 550, 'ml', 140),
  pack('Fish sauce', PANTRY, 'bottle', 350, 'ml', 40, { also: ['patis'] }),
  pack('Oyster sauce', PANTRY, 'bottle', 405, 'g', 85, { perMl: 1.2 }),
  pack('Hoisin sauce', PANTRY, 'jar', 240, 'g', 120, { perMl: 1.2 }),
  pack('Ketchup', PANTRY, 'bottle', 320, 'g', 55, { perMl: 1.1, also: ['banana ketchup', 'tomato ketchup'] }),
  pack('Tomato sauce', PANTRY, 'pouch', 250, 'g', 28, { perMl: 1.05 }),
  pack('Tomato paste', PANTRY, 'sachet', 150, 'g', 35, { perMl: 1.1 }),
  pack('Crushed tomatoes', PANTRY, 'can', 411, 'g', 85),
  pack('Doubanjiang', PANTRY, 'jar', 226, 'g', 140, { perMl: 1.1, also: ['chili bean sauce', 'chili bean paste'] }),
  pack('Bagoong alamang', PANTRY, 'jar', 250, 'g', 75, { perMl: 1, also: ['shrimp paste', 'bagoong'] }),
  pack('Liver spread', PANTRY, 'can', 85, 'g', 40),
  pack('Caesar dressing', PANTRY, 'bottle', 237, 'ml', 180),
  pack('Tartar sauce', PANTRY, 'bottle', 220, 'ml', 95),
  pack('Peanut butter', PANTRY, 'jar', 340, 'g', 110, { perMl: 1.05 }),
  pack('Honey', PANTRY, 'bottle', 250, 'g', 150, { perMl: 1.4 }),
  pack('Shaoxing wine', PANTRY, 'bottle', 640, 'ml', 220, { also: ['chinese cooking wine'] }),

  // Pantry: cans, oils, stock
  pack('Coconut milk', PANTRY, 'can', 400, 'ml', 45, { also: ['gata'] }),
  pack('Coconut cream', PANTRY, 'can', 400, 'ml', 50, { also: ['kakang gata'] }),
  pack('Pineapple chunks', PANTRY, 'can', 432, 'g', 55),
  pack('Bamboo shoots', PANTRY, 'can', 227, 'g', 45),
  pack('Cooking oil', PANTRY, 'bottle', 1000, 'ml', 120, { also: ['vegetable oil', 'canola oil', 'oil'] }),
  pack('Sesame oil', PANTRY, 'bottle', 150, 'ml', 120),
  pack('Olive oil', PANTRY, 'bottle', 250, 'ml', 250),
  // Stock is bought as broth cubes: one cube makes about 500 ml.
  pack('Chicken broth cubes', PANTRY, 'pack', 6, 'pc', 50, { perMl: 1 / 500, also: ['chicken stock', 'chicken broth'] }),
  pack('Beef broth cubes', PANTRY, 'pack', 6, 'pc', 50, { perMl: 1 / 500, also: ['beef stock', 'beef broth'] }),
  pack('Sparkling water', PANTRY, 'bottle', 500, 'ml', 35, { also: ['soda water', 'club soda'] }),

  // Pantry: dry goods (perMl is grams per ml, for amounts given in cups or spoons)
  pack('Sugar', PANTRY, 'pack', 1000, 'g', 85, { perMl: 0.85, also: ['white sugar'] }),
  pack('Brown sugar', PANTRY, 'pack', 1000, 'g', 80, { perMl: 0.9 }),
  pack('Rock sugar', PANTRY, 'pack', 400, 'g', 90),
  pack('All-purpose flour', PANTRY, 'pack', 1000, 'g', 70, { perMl: 0.53, also: ['flour'] }),
  pack('Toasted rice flour', PANTRY, 'pack', 500, 'g', 60, { perMl: 0.5, also: ['glutinous rice flour', 'rice flour'] }),
  pack('Cornstarch', PANTRY, 'pack', 250, 'g', 30, { perMl: 0.53, also: ['cornflour', 'corn starch'] }),
  pack('Breadcrumbs', PANTRY, 'pack', 200, 'g', 45, { perMl: 0.45, also: ['bread crumbs', 'panko'] }),
  pack('Croutons', PANTRY, 'pack', 70, 'g', 55, { perMl: 0.125 }),
  pack('Roasted peanuts', PANTRY, 'pack', 100, 'g', 30, { also: ['peanuts'] }),
  pack('Cashew nuts', PANTRY, 'pack', 100, 'g', 70, { also: ['cashews'] }),
  pack('Raisins', PANTRY, 'pack', 100, 'g', 45),
  pack('Dried taro leaves', PANTRY, 'pack', 100, 'g', 60),
  pack('Tamarind soup mix', PANTRY, 'sachet', 22, 'g', 25, { per: { pack: 22 }, also: ['sinigang mix'] }),

  // Pantry: spices
  pack('Annatto powder', PANTRY, 'sachet', 10, 'g', 18, { perMl: 0.4, also: ['achuete powder', 'atsuete powder'] }),
  pack('Chinese five-spice', PANTRY, 'pack', 30, 'g', 45, { perMl: 0.45, also: ['five-spice powder', 'five spice'] }),
  pack('Ground black pepper', PANTRY, 'bottle', 28, 'g', 60, { perMl: 0.45, also: ['black pepper', 'pepper'] }),
  pack('White pepper', PANTRY, 'bottle', 25, 'g', 55, { perMl: 0.45, also: ['ground white pepper'] }),
  pack('Whole peppercorns', PANTRY, 'pack', 50, 'g', 45, { perMl: 0.55, also: ['peppercorns', 'black peppercorns'] }),
  pack('Sichuan peppercorns', PANTRY, 'pack', 50, 'g', 120, { perMl: 0.3 }),
  pack('Star anise', PANTRY, 'pack', 20, 'g', 40, { per: { pc: 1 } }),
  pack('Bay leaves', PANTRY, 'pack', 10, 'pc', 15, { also: ['laurel leaves', 'dried bay leaves'] }),
  pack('Dried thyme', PANTRY, 'bottle', 10, 'g', 90, { perMl: 0.2, also: ['thyme'] }),
  pack('Kasubha', PANTRY, 'pack', 5, 'g', 15, { perMl: 0.15, also: ['safflower'] }),
  pack('Dried red chilies', PANTRY, 'pack', 50, 'g', 45, { per: { pc: 0.5 } }),

  // Pantry: rice, noodles, bread
  loose('Rice', PANTRY, 'g', 55, { step: 1000, perMl: 0.83, also: ['white rice', ['cooked rice', { perMl: 0.27 }]] }),
  pack('Glutinous rice', PANTRY, 'pack', 1000, 'g', 80, { perMl: 0.83, also: ['malagkit', 'sticky rice'] }),
  pack('Canton noodles', PANTRY, 'pack', 500, 'g', 70, { also: ['pancit canton'] }),
  sizes('Instant pancit canton', PANTRY, 'pack', [
    { sold: 'pack', size: 1, price: 17 },
    { sold: 'bundle', size: 6, price: 95 },
  ], {
    per: { pack: 1, bundle: 6 },
    perG: 1 / 60, // one pack is about 60 g
    also: ['instant canton', 'instant pancit', 'lucky me pancit canton', 'pancit canton instant'],
  }),
  pack('Egg noodles', PANTRY, 'pack', 400, 'g', 60),
  pack('Spaghetti', PANTRY, 'pack', 500, 'g', 90),
  pack('Fettuccine', PANTRY, 'pack', 500, 'g', 120),
  pack('Elbow macaroni', PANTRY, 'pack', 400, 'g', 70, { also: ['macaroni'] }),
  pack('Lumpia wrappers', PANTRY, 'pack', 25, 'pc', 45),
  pack('Dumpling wrappers', PANTRY, 'pack', 30, 'pc', 60),
  pack('Burger buns', PANTRY, 'pack', 6, 'pc', 75, { also: ['hamburger buns'] }),
  pack('White bread', PANTRY, 'loaf', 20, 'pc', 75, { per: { slice: 1 }, also: ['bread', 'sliced bread'] }),

  // Protein: meat and fish by weight at the counter (price per kg)
  loose('Chicken', PROTEIN, 'g', 240, { step: 100, also: ['chicken cut-ups'] }),
  loose('Whole chicken', PROTEIN, 'pc', 300, { perG: 1 / 1200 }),
  loose('Chicken breast', PROTEIN, 'g', 320, { step: 100 }),
  loose('Chicken thighs', PROTEIN, 'g', 260, { step: 100 }),
  loose('Ground pork', PROTEIN, 'g', 340, { step: 100, also: ['giniling'] }),
  loose('Pork belly', PROTEIN, 'g', 380, { step: 100, also: ['liempo'] }),
  loose('Pork shoulder', PROTEIN, 'g', 360, { step: 100, also: ['kasim'] }),
  loose('Pork ribs', PROTEIN, 'g', 340, { step: 100, also: ['spareribs'] }),
  loose('Pork chops', PROTEIN, 'g', 350, { step: 100, per: { pc: 200 } }),
  loose('Pork liver', PROTEIN, 'g', 250, { step: 100 }),
  loose('Ground beef', PROTEIN, 'g', 440, { step: 100 }),
  loose('Beef chuck', PROTEIN, 'g', 480, { step: 100 }),
  loose('Beef flank', PROTEIN, 'g', 520, { step: 100 }),
  loose('Beef sirloin', PROTEIN, 'g', 560, { step: 100 }),
  loose('Oxtail', PROTEIN, 'g', 550, { step: 100 }),
  loose('Char siu', PROTEIN, 'g', 600, { step: 50 }),
  loose('Shrimp', PROTEIN, 'g', 600, { step: 100, also: ['hipon'] }),
  loose('Salmon fillets', PROTEIN, 'g', 1125, { step: 100, also: ['salmon'] }),
  loose('Whole lapu-lapu', PROTEIN, 'g', 500, { step: 100, also: ['lapu-lapu'] }),
  pack('Bacon', PROTEIN, 'pack', 200, 'g', 130),
  pack('Cream dory fillets', PROTEIN, 'pack', 500, 'g', 180, { also: ['cream dory'] }),
  pack('Firm tofu', PROTEIN, 'pack', 250, 'g', 30, { also: ['tofu', 'tokwa'] }),

  // Dairy & eggs
  sizes('Eggs', DAIRY, 'egg', [
    { sold: 'half dozen', size: 6, price: 55 },
    { sold: 'dozen', size: 12, price: 105 },
  ], { per: { dozen: 12 }, also: ['egg', 'large eggs', 'medium eggs'] }),
  pack('Butter', DAIRY, 'bar', 225, 'g', 200, { perMl: 0.96 }),
  pack('Milk', DAIRY, 'carton', 1000, 'ml', 100, { also: ['fresh milk'] }),
  pack('All-purpose cream', DAIRY, 'pack', 250, 'ml', 70),
  pack('Cheese', DAIRY, 'bar', 160, 'g', 70, { also: ['processed cheese'] }),
  pack('Cheddar', DAIRY, 'pack', 250, 'g', 180, { also: ['cheddar cheese'] }),
  pack('Cheddar slices', DAIRY, 'pack', 10, 'pc', 150, { per: { slice: 1 } }),
  pack('Parmesan', DAIRY, 'pack', 100, 'g', 170, { perMl: 0.4, also: ['parmesan cheese'] }),

  // Produce: by the piece, head or bunch (price each). perG lets an amount by
  // weight ("500 g onions") count as pieces: a medium onion is about 100 g.
  loose('Onion', PRODUCE, 'pc', 15, { perG: 1 / 100, also: ['onions', 'red onion', 'white onion'] }),
  loose('Garlic', PRODUCE, 'pc', 15, { label: 'head', perG: 1 / 40, per: { clove: 0.1 }, also: ['bawang'] }),
  loose('Tomato', PRODUCE, 'pc', 10, { perG: 1 / 100, also: ['tomatoes'] }),
  loose('Carrot', PRODUCE, 'pc', 20, { perG: 1 / 150, also: ['carrots'] }),
  loose('Radish', PRODUCE, 'pc', 30, { also: ['labanos'] }),
  loose('Eggplant', PRODUCE, 'pc', 20, { also: ['talong'] }),
  loose('Green papaya', PRODUCE, 'pc', 40),
  loose('Ampalaya', PRODUCE, 'pc', 35, { also: ['bitter gourd'] }),
  loose('Okra', PRODUCE, 'pc', 3),
  loose('Long green chili', PRODUCE, 'pc', 3, { also: ['siling haba'] }),
  loose('Green bell pepper', PRODUCE, 'pc', 25),
  loose('Red bell pepper', PRODUCE, 'pc', 30),
  loose('Lemon', PRODUCE, 'pc', 20),
  loose('Cabbage', PRODUCE, 'pc', 70, { label: 'head' }),
  loose('Broccoli', PRODUCE, 'pc', 70, { label: 'head' }),
  loose('Lettuce', PRODUCE, 'pc', 40, { label: 'head', also: ['iceberg lettuce'] }),
  loose('Romaine lettuce', PRODUCE, 'pc', 60, { label: 'head' }),
  loose('Pechay', PRODUCE, 'pc', 25, { label: 'bunch' }),
  loose('Kangkong', PRODUCE, 'pc', 20, { label: 'bunch' }),
  loose('String beans', PRODUCE, 'pc', 25, { label: 'bunch', also: ['sitaw'] }),
  loose('Chili leaves', PRODUCE, 'pc', 15, { label: 'bunch' }),
  loose('Green onions', PRODUCE, 'pc', 10, { label: 'bunch', also: ['spring onions', 'scallions'] }),
  loose('Chinese chives', PRODUCE, 'pc', 25, { label: 'bunch' }),
  loose('Celery', PRODUCE, 'pc', 40, { label: 'bunch', per: { stalk: 0.125 } }),
  loose('Asparagus', PRODUCE, 'pc', 180, { label: 'bunch' }),
  loose('Rosemary', PRODUCE, 'pc', 40, { label: 'pack', per: { bunch: 1 } }),

  // Produce: by weight or in packs
  loose('Ginger', PRODUCE, 'g', 200, { step: 50, also: ['luya'] }),
  loose('Potatoes', PRODUCE, 'g', 120, { step: 250, per: { pc: 200 }, also: ['potato', 'patatas'] }),
  loose('Squash', PRODUCE, 'g', 120, { step: 250, also: ['kalabasa'] }),
  loose('Snow peas', PRODUCE, 'g', 350, { step: 50, also: ['sitsaro'] }),
  pack('Siling labuyo', PRODUCE, 'pack', 50, 'g', 20, { per: { pc: 1 } }),
  pack('Calamansi', PRODUCE, 'pack', 250, 'g', 40, { per: { pc: 10 } }),
  pack('Shiitake mushrooms', PRODUCE, 'pack', 100, 'g', 60),
  pack('Bean sprouts', PRODUCE, 'pack', 250, 'g', 25, { also: ['togue'] }),
  pack('Green peas', PRODUCE, 'pack', 200, 'g', 55, { also: ['peas', 'frozen peas'] }),
]
