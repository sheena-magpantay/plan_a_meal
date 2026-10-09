import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Globe, ListChecks, Plus, Sparkles, X } from "lucide-react";
import {
  listMealPlan,
  removeFromMealPlan,
  getShoppingList,
  listRecipes,
  addToMealPlan,
} from "../api/index.js";
import { AI_ENABLED, planWeek } from "../api/ai.js";
import LoadingLabel, { AI_PLAN_STEPS } from "../components/LoadingLabel.jsx";
import RecipeImage from "../components/RecipeImage.jsx";
import { useAuth, displayName } from "../auth.jsx";
import { peso } from "../format.js";
import { costToBuy } from "../shopping.js";
import {
  DAYS,
  currentWeekStart,
  weekDates,
  todayName,
  formatWeekRange,
  formatShortDate,
} from "../week.js";

function pickSuggestions(recipes, plan, count = 4) {
  const planned = new Set(plan.map((entry) => entry.recipe_id));
  const choices = recipes.filter((recipe) => !planned.has(recipe.id));
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices.slice(0, count);
}

function averageDailyCalories(plan) {
  const perDay = {};
  for (const entry of plan) perDay[entry.day] = (perDay[entry.day] ?? 0) + entry.calories;
  const days = Object.values(perDay);
  return days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : 0;
}

export default function Home() {
  const { user } = useAuth();
  const [weekStart] = useState(currentWeekStart);
  const [plan, setPlan] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiNote, setAiNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMealPlan(weekStart), getShoppingList(weekStart), listRecipes()])
      .then(([planRows, shoppingRows, recipes]) => {
        if (cancelled) return;
        setPlan(planRows);
        setShopping(shoppingRows);
        setRecipes(recipes);
        setSuggestions(pickSuggestions(recipes, planRows));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  async function removeMeal(entry) {
    setRemovingId(entry.id);
    setRemoveError("");
    try {
      await removeFromMealPlan(entry.id);
      const [planRows, shoppingRows] = await Promise.all([
        listMealPlan(weekStart),
        getShoppingList(weekStart),
      ]);
      setPlan(planRows);
      setShopping(shoppingRows);
    } catch (err) {
      setRemoveError(`Couldn't remove ${entry.recipe_name}: ${err.message}`);
    } finally {
      setRemovingId(null);
    }
  }

  async function planWithAi() {
    if (aiBusy) return;
    const openDays = DAYS.filter((day) => !plan.some((entry) => entry.day === day));
    setAiError("");
    setAiNote("");
    if (openDays.length === 0) {
      setAiError("Every day already has a meal. Remove some to let AI plan them.");
      return;
    }

    setAiBusy(true);
    try {
      const picks = await planWeek({
        days: openDays,
        prompt: aiPrompt.trim(),
        recipes: recipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          cuisine: recipe.cuisine,
          minutes: recipe.minutes,
          calories: recipe.calories,
          cost: recipe.total_cost,
        })),
      });
      if (picks.length === 0) throw new Error("The AI didn't return a plan. Try again.");

      for (const pick of picks) {
        await addToMealPlan({ recipe_id: pick.recipe_id, day: pick.day, week_start: weekStart });
      }
      const [planRows, shoppingRows] = await Promise.all([
        listMealPlan(weekStart),
        getShoppingList(weekStart),
      ]);
      setPlan(planRows);
      setShopping(shoppingRows);
      setSuggestions(pickSuggestions(recipes, planRows));
      setAiNote(
        `Planned ${picks.length} ${picks.length === 1 ? "day" : "days"}. Your shopping list is updated.`
      );
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  if (status === "loading") return <p className="text-muted">Loading your week…</p>;
  if (status === "error") {
    return (
      <p className="errorText" role="alert">
        Couldn't load your week: {error}
      </p>
    );
  }

  const budget = costToBuy(shopping);
  const calories = averageDailyCalories(plan);
  const checkedCount = shopping.filter((item) => item.checked).length;
  const toBuy = shopping.filter((item) => !item.checked);
  const dates = weekDates(weekStart);
  const today = todayName();

  return (
    <section className="home">
      <div className="homeTop">
        <div>
          <h1>{user ? `Hello, ${displayName(user)}!` : "Hello!"}</h1>
          <div className="statGrid">
            <Stat
              label="Budget this week"
              value={peso.format(budget)}
              note={`${plan.length} ${plan.length === 1 ? "meal" : "meals"} planned`}
            />
            <Stat
              label="Average calories"
              value={calories ? `${calories} kcal` : "—"}
              note="per planned day"
            />
            <Stat label="Shopping items" value={shopping.length} note={`${checkedCount} checked`} />
          </div>
        </div>

        <Link to="/shopping-list" className="card shoppingPreview">
          <span className="shoppingPreviewHeader">
            <span className="text-title">Shopping List</span>
            <ArrowRight aria-hidden="true" />
          </span>
          {shopping.length === 0 ? (
            <span className="text-muted">Nothing yet. Add recipes to your week to fill it.</span>
          ) : toBuy.length === 0 ? (
            <span className="text-muted">Everything is checked off.</span>
          ) : (
            <>
              <span className="text-muted">{toBuy.length} left to buy</span>
              <span className="shoppingPreviewItems">
                {toBuy.slice(0, 4).map((item) => item.name).join(", ")}
                {toBuy.length > 4 && `, and ${toBuy.length - 4} more`}
              </span>
            </>
          )}
        </Link>
      </div>

      <h2 className="dividerHeading">
        <span>This week's meals</span>
      </h2>
      <p className="weekRange text-muted">
        {formatWeekRange(weekStart)} · starts fresh every Monday
      </p>

      {AI_ENABLED && (
        <div className="aiBox aiPlanBox">
          <label className="aiTitle" htmlFor="ai-plan-prompt">
            <Sparkles size={16} aria-hidden="true" /> Let AI plan your week
          </label>
          <div className="aiRow">
            <input
              id="ai-plan-prompt"
              className="input"
              placeholder="Optional, e.g. budget-friendly, more Filipino, no pork"
              maxLength={300}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  planWithAi();
                }
              }}
            />
            <button type="button" className="btn btn-accent" onClick={planWithAi} disabled={aiBusy}>
              {aiBusy ? <LoadingLabel messages={AI_PLAN_STEPS} /> : "Plan my week"}
            </button>
          </div>
          {aiError && (
            <p className="errorText" role="alert">
              {aiError}
            </p>
          )}
          {aiNote && !aiError && (
            <p className="aiNote" role="status">
              {aiNote}
            </p>
          )}
        </div>
      )}

      {removeError && (
        <p className="errorText" role="alert">
          {removeError}
        </p>
      )}

      <ol className="weekGrid">
        {DAYS.map((day, index) => {
          const meals = plan.filter((entry) => entry.day === day);
          return (
            <li key={day} className={day === today ? "dayColumn dayToday" : "dayColumn"}>
              <div className="dayHeader">
                <span className="text-label">{day.slice(0, 3)}</span>
                <span className="dayDate">
                  {day === today ? "Today" : formatShortDate(dates[index])}
                </span>
              </div>

              <ul className="dayMeals">
                {meals.map((entry) => (
                  <li key={entry.id} className="dayMeal">
                    <Link className="dayMealName" to={`/recipes?recipe=${entry.recipe_id}`}>
                      {entry.recipe_name}
                    </Link>
                    <span className="dayMealCost text-muted">{peso.format(entry.total_cost)}</span>
                    <button
                      type="button"
                      className="dayMealRemove"
                      aria-label={`Remove ${entry.recipe_name} from ${day}`}
                      disabled={removingId === entry.id}
                      onClick={() => removeMeal(entry)}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </li>
                ))}
              </ul>

              <Link
                className="btn btn-primary btn-sm dayAdd"
                to={`/recipes?day=${day}`}
                aria-label={`Add a recipe to ${day}`}
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="sectionHeader">
        <h2 className="text-title">Suggested meals</h2>
        <Link to="/recipes" className="browseAll">
          Browse all <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <ul className="suggestionGrid">
        {suggestions.map((recipe) => (
          <li key={recipe.id}>
            <Link className="suggestion" to={`/recipes?recipe=${recipe.id}`}>
              <div className="suggestionMedia">
                <RecipeImage src={recipe.image} />
                <ul className="suggestionInfo">
                  <li>
                    <Globe size={14} aria-hidden="true" /> {recipe.cuisine}
                  </li>
                  <li>
                    <ListChecks size={14} aria-hidden="true" /> {recipe.ingredient_count}{" "}
                    ingredients
                  </li>
                  <li>
                    <Clock size={14} aria-hidden="true" /> {recipe.minutes} min
                  </li>
                </ul>
              </div>
              <span className="suggestionName">{recipe.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="card stat">
      <span className="statLabel">{label}</span>
      <span className="statValue">{value}</span>
      <span className="statNote text-muted">{note}</span>
    </div>
  );
}
