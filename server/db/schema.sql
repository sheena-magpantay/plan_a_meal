CREATE TABLE IF NOT EXISTS recipes (
  id       SERIAL  PRIMARY KEY,
  name     TEXT    NOT NULL,
  cuisine  TEXT    NOT NULL CHECK (cuisine IN ('Filipino', 'Chinese', 'Western')),
  minutes  INTEGER NOT NULL CHECK (minutes > 0),
  image    TEXT    NOT NULL DEFAULT '',
  calories INTEGER NOT NULL DEFAULT 0 CHECK (calories >= 0) 
);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS calories INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS custom BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 4
  CHECK (servings BETWEEN 1 AND 100);

CREATE TABLE IF NOT EXISTS ingredients (
  id             SERIAL        PRIMARY KEY,
  recipe_id      INTEGER       NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit           TEXT          NOT NULL DEFAULT '',
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  position       INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ingredients_recipe_id_idx
  ON ingredients (recipe_id, position);

CREATE TABLE IF NOT EXISTS meal_plan (
  id         SERIAL      PRIMARY KEY,
  recipe_id  INTEGER     NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  week_start DATE        NOT NULL,
  day        TEXT        NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday',
                                                'Thursday', 'Friday', 'Saturday', 'Sunday')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE meal_plan ADD COLUMN IF NOT EXISTS week_start DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE meal_plan DROP CONSTRAINT IF EXISTS meal_plan_recipe_id_day_key;

CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_week_recipe_day_idx
  ON meal_plan (week_start, recipe_id, day);

CREATE TABLE IF NOT EXISTS shopping_checks (
  week_start DATE NOT NULL,
  item_key   TEXT NOT NULL,
  PRIMARY KEY (week_start, item_key)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id             SERIAL        PRIMARY KEY,
  week_start     DATE          NOT NULL,
  name           TEXT          NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  amount         TEXT          NOT NULL DEFAULT '' CHECK (length(amount) <= 40),
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  added_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_items_week_idx ON shopping_items (week_start);

ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,3) NOT NULL DEFAULT 1
    CHECK (quantity > 0 AND quantity <= 10000);
ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '' CHECK (length(unit) <= 20);

CREATE TABLE IF NOT EXISTS shopping_quantities (
  week_start DATE          NOT NULL,
  item_key   TEXT          NOT NULL,
  quantity   NUMERIC(10,3) NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
  PRIMARY KEY (week_start, item_key)
);
