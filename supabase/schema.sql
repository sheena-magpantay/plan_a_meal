-- Plan a Meal on Supabase: accounts and each user's saved week.
--
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste the
-- whole file > Run. It is safe to run again.
--
-- The recipe list itself is not stored here. It is bundled with the client
-- from server/db/recipes.js, so every account starts from the same 40 dishes.
-- What IS stored is everything a user changes: their weekly plan, the items
-- they tick on the shopping list, and their own edits to a recipe's
-- ingredients.
--
-- Row Level Security is what keeps accounts apart. The publishable key in the
-- client is public, so without these policies anyone could read every row.
-- Every policy below says the same thing: you can only see and change rows
-- whose user_id is your own.

-- ---------------------------------------------------------------------------
-- Profiles: one row per account, created automatically on sign up.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Chosen on the sign up form. NULL for accounts made with Google.
  username   TEXT        CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Maria" and "maria" are the same username.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own profile" ON public.profiles;
CREATE POLICY "Read own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

-- Makes the profile row as soon as Supabase creates the account. The username
-- comes from the metadata the sign up form sends (see client/src/auth.jsx).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'username', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The sign up form asks this before creating the account, so a taken name
-- gets a clear message instead of a generic database error.
CREATE OR REPLACE FUNCTION public.username_available(name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(name)
  );
$$;

-- Supabase signs in with an email address, but the login form asks for a
-- username. This looks up the email that belongs to a username.
--
-- Trade-off: anyone who knows a username can learn its email address. If that
-- matters for your project, drop this function and ask for the email instead.
CREATE OR REPLACE FUNCTION public.email_for_username(name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(p.username) = lower(name);
$$;

GRANT EXECUTE ON FUNCTION public.username_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_for_username(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Weekly meal plan
-- ---------------------------------------------------------------------------

-- A recipe added to a day of a given week. week_start is that week's Monday,
-- which is how the plan "resets": the app only asks for the current week, so
-- a new Monday starts empty while past weeks stay here as history.
CREATE TABLE IF NOT EXISTS public.meal_plan (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  recipe_id  INTEGER     NOT NULL CHECK (recipe_id > 0),
  week_start DATE        NOT NULL,
  day        TEXT        NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday',
                                                 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A recipe can go on several days, but only once per day in a given week.
  UNIQUE (user_id, week_start, recipe_id, day)
);

ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own meal plan" ON public.meal_plan;
CREATE POLICY "Own meal plan" ON public.meal_plan
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Ticked shopping list items
-- ---------------------------------------------------------------------------

-- A row means "checked"; unticking deletes it. item_key names the shopping
-- list line, e.g. "product:soy sauce" (see server/db/shoppingList.js).
CREATE TABLE IF NOT EXISTS public.shopping_checks (
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  item_key   TEXT NOT NULL,
  PRIMARY KEY (user_id, week_start, item_key)
);

ALTER TABLE public.shopping_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own shopping checks" ON public.shopping_checks;
CREATE POLICY "Own shopping checks" ON public.shopping_checks
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- A user's own version of a recipe's ingredients
-- ---------------------------------------------------------------------------

-- Saved from the Edit ingredients screen. It replaces the bundled list for
-- that user only, so one person's edits never change anyone else's recipes.
-- ingredients is an array of { name, quantity, unit, estimated_cost }.
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  recipe_id   INTEGER     NOT NULL CHECK (recipe_id > 0),
  ingredients JSONB       NOT NULL CHECK (jsonb_typeof(ingredients) = 'array'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own recipe edits" ON public.recipe_ingredients;
CREATE POLICY "Own recipe edits" ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Items added to the shopping list by hand
-- ---------------------------------------------------------------------------

-- "Add an item" on the Grocery List: things to buy that are not in a planned
-- recipe (toothpaste, snacks, a spare dozen eggs). Kept per week, like the
-- plan. amount is free text as typed, e.g. "2 packs". Ticking one stores
-- "custom:<id>" in shopping_checks.
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id             BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        UUID          NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start     DATE          NOT NULL,
  name           TEXT          NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  amount         TEXT          NOT NULL DEFAULT '' CHECK (length(amount) <= 40),
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  added_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_items_user_week_idx
  ON public.shopping_items (user_id, week_start);

-- Added items are now a quantity and a unit ("2", "bottle"); the app works
-- out the cost. estimated_cost holds an AI estimate for items the store
-- catalog does not know, and 0 otherwise. amount is no longer used.
ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,3) NOT NULL DEFAULT 1
    CHECK (quantity > 0 AND quantity <= 10000);
ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '' CHECK (length(unit) <= 20);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own shopping items" ON public.shopping_items;
CREATE POLICY "Own shopping items" ON public.shopping_items
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Recipes a user added themselves
-- ---------------------------------------------------------------------------

-- "Add a recipe" on the Recipes screen. Only its owner sees it. Ids start at
-- 1001 so they never collide with the 40 bundled recipes (ids 1 to 40), which
-- lets meal_plan.recipe_id point at either kind. ingredients is an array of
-- { name, quantity, unit, estimated_cost }, filled in on the edit screen.
CREATE TABLE IF NOT EXISTS public.user_recipes (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY (START WITH 1001) PRIMARY KEY,
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  cuisine     TEXT        NOT NULL CHECK (cuisine IN ('Filipino', 'Chinese', 'Western')),
  minutes     INTEGER     NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  calories    INTEGER     NOT NULL DEFAULT 0 CHECK (calories BETWEEN 0 AND 10000),
  image       TEXT        NOT NULL DEFAULT '' CHECK (length(image) <= 500),
  ingredients JSONB       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(ingredients) = 'array'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_recipes_user_idx ON public.user_recipes (user_id);

ALTER TABLE public.user_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own recipes" ON public.user_recipes;
CREATE POLICY "Own recipes" ON public.user_recipes
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Quantities the user changed on the shopping list
-- ---------------------------------------------------------------------------

-- The Grocery List suggests how much to buy; the user can change it (3 bottles
-- instead of 1, 0.5 kg instead of 0.4 kg). quantity is in the line's buying
-- unit: packages, pieces, eggs, or kg / L for things sold by weight. No row
-- means "use the suggestion". Kept per week, like the plan.
CREATE TABLE IF NOT EXISTS public.shopping_quantities (
  user_id    UUID          NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start DATE          NOT NULL,
  item_key   TEXT          NOT NULL CHECK (length(item_key) <= 200),
  quantity   NUMERIC(10,3) NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
  PRIMARY KEY (user_id, week_start, item_key)
);

ALTER TABLE public.shopping_quantities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own shopping quantities" ON public.shopping_quantities;
CREATE POLICY "Own shopping quantities" ON public.shopping_quantities
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Servings
-- ---------------------------------------------------------------------------

-- How many people a recipe's ingredient amounts are for, set on the edit
-- screen ("Serves 6 people" scales every amount). NULL means the recipe's
-- default of 4.
ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS servings INTEGER CHECK (servings BETWEEN 1 AND 100);
ALTER TABLE public.user_recipes
  ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 4 CHECK (servings BETWEEN 1 AND 100);
