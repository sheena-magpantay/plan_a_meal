# AI usage

This project was built with AI assistance. This file is the record of it. It is
graded as the finals badge, and it is worth 100 points.

The assistant I used throughout was **Claude (Claude Code)**. It wrote most of the back end. I wrote the smaller building blocks of the client, the sidebar, and some of the styling myself.

## 1. How I used AI

### 2026-09-23 - Recipes database, home screen and shopping list

- **Tool:** Claude Code
- **What I asked for:** A starting database and API for the meal planner: a recipes table with ingredients, a weekly meal plan, and a shopping list built from whatever is planned that week. Also a set of Filipino, Chinese and Western recipes to seed it with, and the Home, Recipes and Shopping list screens to show them.
- **What it gave back:** `server/db/schema.sql`, `server/db/recipes.js` (about 40 recipes with ingredient amounts and peso costs), `server/recipesRepo.js`, the `/api/recipes`, `/api/meal-plan` and `/api/shopping-list` routes in `server/server.js`, a first `shoppingList.js`, and the screens.
- **What I kept, what I changed, and why:** I kept the schema and routes. I rewrote the client helpers myself (`week.js`, `categories.js`, `format.js`, `shopping.js`) and the seed runner `seed.js`, and did the layout and CSS on my own because I wanted the screens to match my mockup, not a generic look.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/6c79e6b99bc8d01692d104c818208a601dba20f2

### 2026-09-24 - Shopping list in real supermarket packs

- **Tool:** Claude Code
- **What I asked for:** The shopping list was showing amounts like "0.5 cup + 3 tbsp" of soy sauce, which nobody can buy. I asked for it to show things the way a Philippine supermarket sells them.
- **What it gave back:** A product catalog (`server/db/storeProducts.js`) with pack sizes and peso prices, and a rewrite of `shoppingList.js` that converts each recipe amount into the product's unit, adds them up and rounds up to whole packs ("1 bottle (385 ml)").
- **What I kept, what I changed, and why:** I kept the approach because it fixed the actual problem. I changed the quantity display and the spacing of the quantity column on the shopping list screen.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/ed284dc37171c1d0b037b45017011d91508c24dd

### 2026-09-26 - Accounts with Supabase

- **Tool:** Claude Code
- **What I asked for:** Login, sign up and a profile page, so each person's week is saved to their own account.
- **What it gave back:** `supabase/schema.sql` with row level security on every table, `client/src/api/supabaseApi.js` (the same functions as the Express client but against Supabase), and the login/sign up screen `authpage.jsx`.
- **What I kept, what I changed, and why:** I kept the schema and `supabaseApi.js`. I wrote `supabase.js` (creating the client only when both environment variables are set) and `auth.jsx` (the session context and the sign in / sign up / sign out functions) myself, and the profile page layout.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/df1d33f156e45ccdb35cfa73719ab8fbaa977038

### 2026-09-26 - "Add a recipe" with an AI suggestion

- **Tool:** Claude Code
- **What I asked for:** A way for users to add their own recipe, with a button that suggests a recipe from a short prompt using the Gemini API, and an estimated price for ingredients that are not in the store list.
- **What it gave back:** A Supabase Edge Function (`generate-recipe`) that calls Gemini with a JSON schema so the reply is always a recipe in the right shape, `client/src/api/ai.js` to call it, `client/src/pricing.js`, the New Recipe dialog in `recipes.jsx`, and an editable ingredients screen.
- **What I kept, what I changed, and why:** I kept the Edge Function idea because the Gemini key has to stay on the server, not in the browser build. I added a rule to the prompt so it does not suggest ingredients that are hard to buy here (truffle oil), and later reworked its error handling (see section 2).
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/6932b58bf8ccb201baa1e9750bbbe463f54ef50d

### 2026-09-27 - Real store prices and recipe photos

- **Tool:** Claude Code
- **What I asked for:** Help updating the prices in `storeProducts.js` to what the online stores (SM, Shopwise, S&R, WalterMart) actually charge, and better error messages from the Gemini function.
- **What it gave back:** An updated catalog using the median regular price across the stores, and a new error handler in the Edge Function.
- **What I kept, what I changed, and why:** I kept the prices but checked several of them against the store sites myself. I found and added the recipe photos myself and wrote `RecipeImage.jsx` so they load from `src/assets/recipes/`.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/e6d1788a7cf996219c18b7d046077bb66f320a97

### 2026-10-04 - Card animations and the Add to Plan button

- **Tool:** Claude Code
- **What I asked for:** Recipe cards that fade in as you scroll, and the cuisine / ingredient count / time showing when you hover a suggested meal on the home screen.
- **What it gave back:** A `useRevealOnScroll` hook using `IntersectionObserver`, and the Add to Plan logic split out of `RecipeCard` into `useAddToPlan` and a `DayPicker` component.
- **What I kept, what I changed, and why:** I kept the hook and the split, since the card was getting too long. I wrote the CSS for the animation and the hover info myself and tuned the delay between cards.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/8f56fddd56bb4029ec708cda00c513bb970f596c

## 2. Where the AI got it wrong

### Case 1 - Gemini errors all looked the same

- **What it gave me:** The first Edge Function caught every failed Gemini request and returned "The AI could not answer. Try again."
- **What was wrong with it:** When the AI button failed I could not tell why. The real causes were an invalid API key and Gemini being overloaded (status 503), and 503 was not even treated as "busy" like 429 was. The useful message from Gemini only went to the function logs.
- **What I did instead:** Read Gemini's own error message from the reply and pass a short version of it back, treat 503 the same as 429 ("The AI is busy right now"), and say clearly when the key was rejected. Then I set the key again and it worked.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/e6d1788a7cf996219c18b7d046077bb66f320a97

### Case 2 - Hand-added shopping items had no price

- **What it gave me:** `customItem` and `catalogPrices` in `server/db/shoppingList.js` used `toProductUnit` to convert what the user typed into the product's unit.
- **What was wrong with it:** If you added something by hand like "2 pc soy sauce", `toProductUnit` returned `null` because "pc" is not the unit the bottle is sold in. The item showed up with no price and did not count toward
  the total.
- **What I did instead:** Added `handAddedNeed`: if the normal conversion fails and the unit is "pc" on a packaged product, treat it as that many packs (`quantity * product.size`).
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/44a0c900900f77625dd792b67fde9824c3007624

### Case 3 - Logging in with a username leaked emails

- **What it gave me:** Login with a username or an email. Supabase only knows emails, so the schema had a function `email_for_username` that returned the account's email for a username, granted to the `anon` role.
- **What was wrong with it:** Anyone, without logging in, could call that function with a username and get back that person's email address.
- **What I did instead:** Removed username login. `signIn` now takes an email only, the error says "Wrong email or password", and the login form has no username field. Usernames are still used as display names.
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/ce030ab04ec6fc884f07f5631ee69d80d38758d4

## 3. Who wrote what
### Written by me

- **File:** `client/src/styles.css`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/ebc62b694aab504cc930fa0df76ffaea372b557d, https://github.com/sheena-magpantay/plan_a_meal/commit/8f56fddd56bb4029ec708cda00c513bb970f596c
- **What it does and why it is built this way:** Most of the app's styling: the sidebar, the recipe grid and cards, the dialogs, the shopping list and the login page. Colors and spacing are CSS variables at the top so I can change the theme in one place. The card animation starts each card slightly lower and transparent, and the `is-visible` class moves it into place. The delay comes from a `--reveal-delay` variable so the cards appear one after another.

- **File:** `client/src/sidebar.jsx`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/522ca49d9b64e9d90da4ff683a84b27f2d2396db
- **What it does and why it is built this way:** The navigation. The links are one array (`nav_icons`), so adding a page is one line. `NavLink` tells me which page is active so I can highlight it. The logo is the first item and links home, and it never gets the active style.

- **File:** `client/src/auth.jsx` and `client/src/supabase.js`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/df1d33f156e45ccdb35cfa73719ab8fbaa977038
- **What it does and why it is built this way:** `supabase.js` creates the Supabase client only if both the URL and the anon key are set. Otherwise the app falls back to the Express API. `auth.jsx` keeps the session in a React context so every screen can read the user. The session starts as `undefined` (not loaded yet), not `null` (logged out), so the app waits instead of flashing the login page. `friendly()` turns Supabase's error messages into ones a normal user understands.

- **File:** `client/src/week.js`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/6c79e6b99bc8d01692d104c818208a601dba20f2
- **What it does and why it is built this way:** A week runs Monday to Sunday and is named by its Monday as `YYYY-MM-DD`. JavaScript's `getDay()` makes Sunday 0, so `(getDay() + 6) % 7` makes Monday 0 instead. It builds dates from year, month and day, not by parsing a string, so the week uses the user's own timezone and flips over at their Monday midnight.

- **File:** `client/src/categories.js`, `client/src/format.js`, `client/src/shopping.js`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/6c79e6b99bc8d01692d104c818208a601dba20f2
- **What it does and why it is built this way:** `categories.js` groups shopping items into Pantry, Protein, Produce and Dairy & Eggs by keyword. The keywords become one regex per category with `\b` word boundaries and an optional `s`/`es`, so "eggs" matches "egg" but "eggplant" does not. `format.js` formats pesos with `Intl.NumberFormat`. `shopping.js` adds up the cost of the items not ticked yet.

- **File:** `client/src/components/LoadingLabel.jsx`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/44a0c900900f77625dd792b67fde9824c3007624
- **What it does and why it is built this way:** While Gemini is working it shows a different message every 1.4 seconds ("Asking the AI", "Checking prices"...) and stops on the last one instead of looping, so it never goes back to "Getting ready". The interval is cleared on unmount. `role="status"` lets screen readers announce it. This improves the user experience instead of static loading.

- **File:** `client/src/components/RecipeImage.jsx`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/e6d1788a7cf996219c18b7d046077bb66f320a97
- **What it does and why it is built this way:** Vite renames image files when it builds, so `import.meta.glob` collects every photo in `assets/recipes/` and maps it by file name without the extension. A recipe can then just say `recipes/chicken-adobo.jpg`. A full URL is used as is. If there is no image or it fails to load, it shows a placeholder icon.


### The AI-written part I understand best

- **File:** `client/src/api/supabaseApi.js`
- **Commit:** https://github.com/sheena-magpantay/plan_a_meal/commit/df1d33f156e45ccdb35cfa73719ab8fbaa977038
- **What it does and why we kept it:** This is what saves each person's week to their own account. It has the same functions as httpApi.js, so the screens work the same whether they use Supabase or my Express API. The 40 starter recipes stay bundled in the app. Only each user's own data (their meal plan, added recipes, ingredient edits and shopping list ticks) is saved in Supabase. The queries never filter by user themselves. The database's row level security only returns rows where user_id matches the logged in user, so even if someone changed the code in their browser, they could not see another person's plan. I kept it because it gave me accounts without hosting my own server and database or building my own login system. Supabase handles the passwords, and the database itself makes sure each user only sees their own data.
