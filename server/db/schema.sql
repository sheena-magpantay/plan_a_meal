-- The complete shape of the database. Safe to run against an empty database,
-- and safe to run twice.
--
-- This file is committed on purpose. Your schema is a fact about your
-- application, not a runtime concern: it should be readable by opening a file
-- rather than by connecting to a server. It is also what lets you move to a
-- hosted database in one command.

CREATE TABLE IF NOT EXISTS recipes (
  id       SERIAL  PRIMARY KEY,
  name     TEXT    NOT NULL,
  cuisine  TEXT    NOT NULL CHECK (cuisine IN ('Filipino', 'Chinese', 'Western')),
  minutes  INTEGER NOT NULL CHECK (minutes > 0),
  image    TEXT    NOT NULL DEFAULT '',
  calories INTEGER NOT NULL DEFAULT 0 CHECK (calories >= 0)  -- per serving, estimated
);

-- Added after the first version of this table. CREATE TABLE IF NOT EXISTS skips
-- a table that is already there, so an existing database gets the columns here.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS calories INTEGER NOT NULL DEFAULT 0;

-- true for recipes added on the Recipes screen, which can be deleted; the
-- seeded ones stay false.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS custom BOOLEAN NOT NULL DEFAULT false;

-- How many people the ingredient amounts are for (the edit screen scales them).
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 4
  CHECK (servings BETWEEN 1 AND 100);

-- One row per ingredient line. estimated_cost is in pesos, for the whole
-- quantity. position keeps the order the user entered them in.
CREATE TABLE IF NOT EXISTS ingredients (
  id             SERIAL        PRIMARY KEY,
  recipe_id      INTEGER       NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit           TEXT          NOT NULL DEFAULT '',
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  position       INTEGER       NOT NULL DEFAULT 0
);

-- Every recipe page reads its ingredients by recipe_id, in position order.
CREATE INDEX IF NOT EXISTS ingredients_recipe_id_idx
  ON ingredients (recipe_id, position);

-- A recipe added to a day of a given week. week_start is that week's Monday,
-- which is how the plan "resets": the app only asks for the current week, so
-- a new Monday starts empty while past weeks stay in the table as history.
CREATE TABLE IF NOT EXISTS meal_plan (
  id         SERIAL      PRIMARY KEY,
  recipe_id  INTEGER     NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  week_start DATE        NOT NULL,
  day        TEXT        NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday',
                                                'Thursday', 'Friday', 'Saturday', 'Sunday')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The first version of meal_plan had no week_start and allowed a recipe once
-- per day forever. Bring an existing table up to date.
ALTER TABLE meal_plan ADD COLUMN IF NOT EXISTS week_start DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE meal_plan DROP CONSTRAINT IF EXISTS meal_plan_recipe_id_day_key;

-- A recipe can go on several days, but only once per day in a given week.
-- The home screen reads a whole week at a time, which this index also serves.
CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_week_recipe_day_idx
  ON meal_plan (week_start, recipe_id, day);

-- Ticked items on a week's shopping list. A row means "checked"; unticking
-- deletes it. item_key names the shopping list line, e.g. "product:soy sauce"
-- (see db/shoppingList.js).
CREATE TABLE IF NOT EXISTS shopping_checks (
  week_start DATE NOT NULL,
  item_key   TEXT NOT NULL,
  PRIMARY KEY (week_start, item_key)
);

-- Items added to a week's shopping list by hand, not from a recipe. amount is
-- free text as typed, e.g. "2 packs". Ticking one stores "custom:<id>" in
-- shopping_checks, like any other line.
CREATE TABLE IF NOT EXISTS shopping_items (
  id             SERIAL        PRIMARY KEY,
  week_start     DATE          NOT NULL,
  name           TEXT          NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  amount         TEXT          NOT NULL DEFAULT '' CHECK (length(amount) <= 40),
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  added_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_items_week_idx ON shopping_items (week_start);

-- Added items are a quantity and a unit; the cost is worked out from the
-- store catalog. amount is no longer used.
ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,3) NOT NULL DEFAULT 1
    CHECK (quantity > 0 AND quantity <= 10000);
ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '' CHECK (length(unit) <= 20);

-- Quantities changed on the shopping list, in the line's buying unit
-- (packages, pieces, eggs, or kg / L). No row means "use the suggestion".
CREATE TABLE IF NOT EXISTS shopping_quantities (
  week_start DATE          NOT NULL,
  item_key   TEXT          NOT NULL,
  quantity   NUMERIC(10,3) NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
  PRIMARY KEY (week_start, item_key)
);
