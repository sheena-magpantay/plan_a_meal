CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username   TEXT        CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.meal_plan (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  recipe_id  INTEGER     NOT NULL CHECK (recipe_id > 0),
  week_start DATE        NOT NULL,
  day        TEXT        NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday',
                                                 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, recipe_id, day)
);

ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own meal plan" ON public.meal_plan;
CREATE POLICY "Own meal plan" ON public.meal_plan
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

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

ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS servings INTEGER CHECK (servings BETWEEN 1 AND 100);
ALTER TABLE public.user_recipes
  ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 4 CHECK (servings BETWEEN 1 AND 100);
