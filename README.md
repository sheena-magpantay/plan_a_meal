# Plan A Meal: Weekly Meal Planner

**Live site:** https://plan-a-meal.onrender.com/

**API:** https://plan-a-meal.onrender.com/healthz

**Demo video:** (https://drive.google.com/file/d/1BF1ayvgUcFD1uIKioJUWvwHAKqE33---/view?usp=sharing)

##  Overview

Plan a Meal lets someone assign recipes to the days of the week and automatically builds the grocery shopping list those meals require. This web is for those people who want an easier way to plan meals and grocery list. In the moment they open it, they're trying to choose recipes for the days ahead, and they won't have to worry about listing the ingredients themselves.

##  Setup and installation

**You need:** Node.js 20 or newer and a free [Supabase](https://supabase.com) project.

1. **Clone the repo and install the dependencies**
   ```bash
   git clone https://github.com/sheena-magpantay/plan_a_meal.git
   cd plan_a_meal/client
   npm install
   ```
2. **Environment variables:** copy `client/.env.example` to `client/.env` and fill in the values from **Supabase → Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon key>
   ```
3. **Database:** in your Supabase project, open the **SQL Editor**, paste all of `supabase/schema.sql` and click **Run**.
4. **AI features (optional):** deploy the `generate-recipe` Edge Function in Supabase, then add your Google AI Studio key under **Edge Functions → Secrets** as `GEMINI_API_KEY`.

## How to run it**

**With accounts (Supabase).** This is how the live site runs. Needs the `client/.env` values from Setup.

```bash
cd client
npm run dev                 # http://localhost:5173
```

**The whole stack with Express.** Needs a PostgreSQL, either local or hosted.

```bash
# 1. the database
docker run --name my-pg -e POSTGRES_PASSWORD=devpassword   -e POSTGRES_DB=haunted -p 5432:5432 -d postgres:17

# 2. the API
cd server
npm install
cp .env.example .env        # check DATABASE_URL
npm run db:reset            # creates the tables and adds the recipes
npm run dev                 # http://localhost:3000

# 3. the client, in another terminal
cd client
npm install
cp .env.example .env        # leave the VITE_SUPABASE_ values empty
# add VITE_USE_MOCK_API=false
npm run dev
```

## Environment variables

| Name | Where | What it is |
| --- | --- | --- |
| `DATABASE_URL` | server | PostgreSQL connection string. Contains a password |
| `CORS_ORIGINS` | server | comma-separated origins allowed to call the API |
| `NODE_ENV` | server | `production` on your host |
| `VITE_SUPABASE_URL` | client, at build time | your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client, at build time | your Supabase publishable (anon) key, never the secret one |
| `VITE_USE_MOCK_API` | client, at build time | only `false` turns demo mode off; ignored when Supabase is set |
| `VITE_API_BASE_URL` | client, at build time | your API's public URL, no trailing slash |
| `VITE_BASE_PATH` | client, at build time | set by the GitHub Pages workflow; leave it unset elsewhere |
| `GEMINI_API_KEY` | Supabase Edge Function secret | your Google AI Studio key |
| `GEMINI_MODEL` | Supabase Edge Function secret | optional, overrides the default Gemini model |

Every `VITE_` value is compiled into the built JavaScript and is public. Never put a secret key, a password or a connection string in one. The Supabase anon key is safe there because Row Level Security protects the data.


## Deploying

**Supabase.** Run `supabase/schema.sql` once in the SQL Editor, deploy the `generate-recipe` Edge Function, and add `GEMINI_API_KEY` under Edge Functions → Secrets. Under Authentication → URL Configuration, add your Render and GitHub Pages URLs so email confirmation and Google login can redirect back.

**Render (live site).** One web service from this repository that builds the client and runs the server. `server.js` serves `client/dist`, so the site and the API share one URL. Use settings like:

- Build command: `cd client && npm ci && npm run build && cd ../server && npm ci`
- Start command: `cd server && npm start`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `NODE_ENV=production`

Run `server/db/schema.sql` once against the Render database (`npm run db:schema` with its `DATABASE_URL`).

**GitHub Pages.** Already wired up in `.github/workflows/deploy-pages.yml`. One-time steps:

1. Settings > Pages > Build and deployment > Source: **GitHub Actions**. Without this the workflow goes green and publishes nothing.
2. Under Settings > Secrets and variables > Actions > Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the workflow.


##  Features

- **Accounts:** sign up or log in with email or Google. Each person's plan, edits and shopping list are saved to their own account.
- **Weekly planner:** assign recipes to Monday to Sunday. The week starts fresh every Monday.
- **AI week planner:** Gemini plans every empty day of the week from your recipes, with an optional request like "budget-friendly, no pork".
- **AI recipe suggestion:** describe a dish and Gemini fills in the name, cuisine, prep time, calories and ingredients.
- **40 starter recipes:** Filipino, Chinese and Western dishes, with search, cuisine filter, "My recipes" and sorting by prep time, ingredients or cost.
- **Add your own recipes:** create and delete your own recipes.
- **Editable ingredients:** change ingredients, quantities and servings, with costs based on Philippine store prices (AI estimates for items not in the store list).
- **Automatic shopping list:** built from the week's meals, grouped into Pantry, Protein, Produce and Dairy & Eggs, with checkboxes, adjustable quantities, extra items and a total cost.
- **Download list:** save the shopping list as a text file to take to the store.
- **Home dashboard:** budget this week, average calories, shopping items left and suggested meals.
- **Profile:** see your account details, change your username and log out.

##  How to use it

1. Log in or create an account.  
2. After logging in, the user sees the week: three cards (budget this week, average calories, and shopping items), a Shopping List preview panel, all seven days of the week with whatever is already assigned, and suggested meals below.  
3. To let AI plan the week, type an optional request in "Let AI plan your week" on the Home screen and click **Plan my week**. It fills every empty day and updates the shopping list.  
4. Browse or search for a recipe. Clicking Recipes in the sidebar (or a suggested meal, or "Browse all") opens the Recipes screen, which shows searchable recipes, each showing the recipe's name, a thumbnail, and two actions: Add to Plan and Edit.  
5. Assign a recipe to a day. Tapping Add to Plan opens an inline "Choose a Day" dropdown right on that card. Picking a day and confirming with the checkmark assigns the recipe.  
6. To add your own recipe, click **Add a recipe** on the Recipes screen. Fill in the details yourself, or describe a dish under "Let AI suggest one" and click **Suggest**.  
7. Tapping Edit on any recipe card opens Recipe Ingredients. The screen has the full ingredient list (name, quantity, estimated cost), a servings picker, an "Add an ingredient" form, and a running cost total. Saving here is what keeps the shopping list accurate later.  
8. After that, the user can see the updated shopping list. Once a few days have recipes assigned, the Shopping List screen auto-generates a list from everything assigned that week, grouped into categories (Pantry, Protein, Dairy, etc.) with a checkbox per item, a running quantity and total cost, and a "Download List" button for taking it to the store.  
9. To change your username, open **Profile**, click **Edit** next to your name, type the new one and press the checkmark.  
10. The weekly meal plan will reset after the week is finished.

##  Architecture

The React app is served by the Express server on Render and runs in the user's browser. On the live site, the browser talks straight to Supabase: Supabase Auth handles login, and its PostgreSQL stores each user's meal plan, own recipes, ingredient edits and shopping list. For the AI features, the browser calls the `generate-recipe` Edge Function on Supabase, which keeps the Gemini key on the server and calls the Google Gemini API. The 40 starter recipes and store prices are bundled in the client, and the Express `/api` routes with Render PostgreSQL are only used in Express mode.

##  Project structure

```
plan_a_meal/
├── .github/workflows/      
├── client/                
│   ├── src/
│   │   ├── api/            
│   │   │   ├── ai.js           
│   │   │   ├── httpApi.js      
│   │   │   ├── index.js      
│   │   │   ├── mockApi.js      
│   │   │   └── supabaseApi.js  
│   │   ├── assets/         
│   │   ├── components/
│   │   │   ├── LoadingLabel.jsx
│   │   │   └── RecipeImage.jsx
│   │   ├── screens/        
│   │   ├── App.jsx        
│   │   ├── auth.jsx        
│   │   ├── categories.js   
│   │   ├── format.js       
│   │   ├── main.jsx        
│   │   ├── pricing.js      
│   │   ├── shopping.js     
│   │   ├── sidebar.jsx     
│   │   ├── styles.css
│   │   ├── supabase.js     
│   │   └── week.js         
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docs/                   
├── server/                 
│   ├── db/
│   │   ├── pool.js           
│   │   ├── recipes.js        
│   │   ├── run.js            
│   │   ├── schema.sql        
│   │   ├── seed.js           
│   │   ├── shoppingList.js   
│   │   └── storeProducts.js  
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── recipesRepo.js      
│   └── server.js           
├── .env.example
├── .gitignore
├── AI-USAGE.md
├── compose.yml             
├── LICENSE
├── README.md
└── START-HERE.md
```
            
## Screenshots
![login](docs/assets/login.PNG)
![signup](docs/assets/signup.PNG)
![home](docs/assets/home.PNG)
![recipes](docs/assets/recipes.PNG)
![recipe_preview](docs/assets/recipe_preview.PNG)
![edit_ingredient](docs/assets/edit_ingredient.PNG)
![grocerylist](docs/assets/shopping.PNG)
![profile](docs/assets/profile.PNG)

## Author

Sheena Magpantay, CS-403

## AI usage

The AI usage is in this link: 
https://github.com/sheena-magpantay/plan_a_meal/blob/main/AI-USAGE.md

## License

MIT, see [LICENSE](LICENSE).
