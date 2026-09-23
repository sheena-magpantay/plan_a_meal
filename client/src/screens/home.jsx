import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, X } from "lucide-react";
import { listMealPlan, removeFromMealPlan, getShoppingList, listRecipes } from "../api/index.js";
import RecipeImage from "../components/RecipeImage.jsx";
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

// Four recipes that are not already in this week's plan, picked at random on
// each visit.
function pickSuggestions(recipes, plan, count = 4) {
  const planned = new Set(plan.map((entry) => entry.recipe_id));
  const choices = recipes.filter((recipe) => !planned.has(recipe.id));
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices.slice(0, count);
}

// Total calories of each planned day, averaged over the days that have meals.
function averageDailyCalories(plan) {
  const perDay = {};
  for (const entry of plan) perDay[entry.day] = (perDay[entry.day] ?? 0) + entry.calories;
  const days = Object.values(perDay);
  return days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : 0;
}

export default function Home() {
  // Fixed for as long as the page is open; a reload after Monday picks up the
  // new week, which starts empty.
  const [weekStart] = useState(currentWeekStart);
  const [plan, setPlan] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMealPlan(weekStart), getShoppingList(weekStart), listRecipes()])
      .then(([planRows, shoppingRows, recipes]) => {
        if (cancelled) return;
        setPlan(planRows);
        setShopping(shoppingRows);
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
      // The shopping list is built from the plan, so it changes too.
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

  if (status === "loading") return <p className="text-muted">Loading your week…</p>;
  if (status === "error") {
    return (
      <p className="errorText" role="alert">
        Couldn't load your week: {error}
      </p>
    );
  }

  // Same as the Grocery List's total cost: what is still left to buy.
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
          <h1>Hello!</h1>
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
              <RecipeImage src={recipe.image} />
              <span>{recipe.name}</span>
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
