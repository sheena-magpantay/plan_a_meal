# Plan A Meal: Weekly Meal Planner

**Live site:** https://plan-a-meal.onrender.com/

**API:** https://plan-a-meal.onrender.com/healthz

**Demo video:** (https://drive.google.com/file/d/1BF1ayvgUcFD1uIKioJUWvwHAKqE33---/view?usp=sharing)

## **\. Overview**

Plan a Meal lets someone assign recipes to the days of the week and automatically builds the grocery shopping list those meals require. This web is for those people who want an easier way to plan meals and grocery list. In the moment they open it, they're trying to choose recipes for the days ahead, and they won't have to worry about listing the ingredients themselves.

## **\. Setup and installation**

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

## **\. How to run it**

```bash
cd client
npm run dev
```

Then open http://localhost:5173.

## **\. Features**

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

## **\. How to use it**

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

## **\. Project structure**

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
            
## **\. Screenshots**
![login](docs/assets/login.PNG)
![signup](docs/assets/signup.PNG)
![home](docs/assets/home.PNG)
![recipes](docs/assets/recipes.PNG)
![recipe_preview](docs/assets/recipe_preview.PNG)
![edit_ingredient](docs/assets/edit_ingredient.PNG)
![grocerylist](docs/assets/shopping.PNG)
![profile](docs/assets/profile.PNG)


## AI usage

The AI usage is in this link: 
https://github.com/sheena-magpantay/plan_a_meal/blob/main/AI-USAGE.md

## License

MIT, see [LICENSE](LICENSE).
