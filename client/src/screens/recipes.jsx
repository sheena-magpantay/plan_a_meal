import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Check, X } from "lucide-react";
import { listRecipes, getRecipe, addToMealPlan } from "../api/index.js";
import RecipeImage from "../components/RecipeImage.jsx";
import { peso } from "../format.js";
import { DAYS, currentWeekStart } from "../week.js";

// Sort options for the dropdown beside the search. Ties keep the default
// (list) order, because Array.prototype.sort is stable.
const SORTS = {
  default: { label: "Default order", compare: () => 0 },
  time: { label: "Least prep time", compare: (a, b) => a.minutes - b.minutes },
  ingredients: {
    label: "Fewest ingredients",
    compare: (a, b) => a.ingredient_count - b.ingredient_count,
  },
  cost: { label: "Lowest cost", compare: (a, b) => a.total_cost - b.total_cost },
};

const CUISINES = ["Filipino", "Chinese", "Western"];

export default function Recipes() {
  // ?day=Monday comes from a day's Add button on the home screen: that day is
  // preselected when choosing a day. ?recipe=5 comes from a suggested meal and
  // opens that recipe's details.
  const [searchParams, setSearchParams] = useSearchParams();
  const dayParam = searchParams.get("day");
  const planningDay = DAYS.includes(dayParam) ? dayParam : "";
  const recipeParam = Number(searchParams.get("recipe"));

  const [recipes, setRecipes] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [cuisine, setCuisine] = useState(""); // "" means all cuisines
  const [openRecipeId, setOpenRecipeId] = useState(
    Number.isInteger(recipeParam) && recipeParam > 0 ? recipeParam : null
  );

  useEffect(() => {
    let cancelled = false;
    listRecipes()
      .then((rows) => {
        if (cancelled) return;
        setRecipes(rows);
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
  }, []);

  const search = query.trim().toLowerCase();
  const visible = recipes
    .filter((recipe) => !cuisine || recipe.cuisine === cuisine)
    .filter((recipe) => `${recipe.name} ${recipe.cuisine}`.toLowerCase().includes(search))
    .sort(SORTS[sort].compare);

  return (
    <section>
      <div className="pageHeader">
        <h1>Recipes</h1>
        <div className="toolbar">
          <label className="search">
            <input
              type="search"
              className="input"
              placeholder="Search for a recipe"
              aria-label="Search for a recipe"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Search className="searchIcon" aria-hidden="true" />
          </label>
          <select
            className="input sortSelect"
            aria-label="Filter by cuisine"
            value={cuisine}
            onChange={(event) => setCuisine(event.target.value)}
          >
            <option value="">All cuisines</option>
            {CUISINES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="input sortSelect"
            aria-label="Sort recipes"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            {Object.entries(SORTS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {planningDay && (
        <p className="planningBanner" role="status">
          Choosing a recipe for <strong>{planningDay}</strong>. Press Add to Plan, then the check
          button. <Link to="/">Back to this week</Link>
        </p>
      )}

      {status === "loading" && <p className="text-muted">Loading recipes…</p>}
      {status === "error" && (
        <p className="errorText" role="alert">
          Couldn't load recipes: {error}
        </p>
      )}
      {status === "ready" && visible.length === 0 && (
        <p className="text-muted">No recipes match your search and filters.</p>
      )}

      <ul className="recipeGrid">
        {visible.map((recipe) => (
          <RecipeCard
            key={`${recipe.id}-${planningDay}`}
            recipe={recipe}
            defaultDay={planningDay}
            onOpen={() => setOpenRecipeId(recipe.id)}
          />
        ))}
      </ul>

      {/* key: each recipe gets a fresh dialog, so a late close event from the
          previous one cannot close the one that just opened */}
      {openRecipeId !== null && (
        <RecipeDetails
          key={openRecipeId}
          recipeId={openRecipeId}
          onClose={() => {
            setOpenRecipeId((current) => (current === openRecipeId ? null : current));
            // Drop ?recipe= so a reload does not open it again.
            if (searchParams.has("recipe")) {
              const next = new URLSearchParams(searchParams);
              next.delete("recipe");
              setSearchParams(next, { replace: true });
            }
          }}
        />
      )}
    </section>
  );
}

function RecipeCard({ recipe, defaultDay, onOpen }) {
  const [choosingDay, setChoosingDay] = useState(false);
  const [day, setDay] = useState(defaultDay);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function confirmDay(event) {
    event.preventDefault();
    if (!day) return;

    setSaving(true);
    setMessage("");
    try {
      await addToMealPlan({ recipe_id: recipe.id, day, week_start: currentWeekStart() });
      setMessage(`Added to ${day}`);
      setChoosingDay(false);
      setDay(defaultDay);
    } catch (err) {
      setMessage(`Couldn't add: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="card recipeCard">
      <RecipeImage src={recipe.image} />
      {/* The button's ::after stretches over the whole card, so clicking
          anywhere on it opens the details. Add to Plan and Edit sit above it. */}
      <h2 className="recipeName">
        <button type="button" className="recipeOpen" onClick={onOpen}>
          {recipe.name}
        </button>
      </h2>
      <p className="text-label text-muted">
        {recipe.cuisine} · {recipe.ingredient_count} ingredients · {recipe.minutes} min
      </p>

      <div className="recipeActions">
        <button
          type="button"
          className="btn btn-primary"
          aria-expanded={choosingDay}
          onClick={() => {
            setChoosingDay((open) => !open);
            setMessage("");
          }}
        >
          Add to Plan
        </button>
        <Link className="btn btn-accent btn-sm" to={`/recipes/${recipe.id}`}>
          Edit
        </Link>
      </div>

      {choosingDay && (
        <form className="dayPicker" onSubmit={confirmDay}>
          <select
            className="input"
            aria-label={`Day to cook ${recipe.name}`}
            value={day}
            onChange={(event) => setDay(event.target.value)}
          >
            <option value="" disabled>
              Choose a Day
            </option>
            {DAYS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn-primary iconBtn"
            aria-label="Confirm day"
            disabled={!day || saving}
          >
            <Check size={16} strokeWidth={2.5} />
          </button>
        </form>
      )}

      {message && (
        <p className="cardMessage text-muted" role="status">
          {message}
        </p>
      )}
    </li>
  );
}

// Pop-up with the recipe's ingredients and estimated cost. Uses <dialog>, so
// Escape closes it and keyboard focus stays inside while it is open.
function RecipeDetails({ recipeId, onClose }) {
  const dialogRef = useRef(null);
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRecipe(null);
    setError("");
    getRecipe(recipeId)
      .then((row) => !cancelled && setRecipe(row))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  // Tell the parent straight away rather than waiting for the dialog's close
  // event, which the browser delivers late (or not at all while the tab is in
  // the background). Escape still arrives through onClose below.
  const close = () => {
    dialogRef.current.close();
    onClose();
  };
  const total = recipe
    ? recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.estimated_cost, 0)
    : 0;

  return (
    <dialog
      ref={dialogRef}
      className="recipeDialog"
      aria-labelledby="recipe-dialog-title"
      onClose={onClose}
      // The dialog itself has no padding, so a click whose target is the
      // dialog element landed on the backdrop outside the content.
      onClick={(event) => event.target === dialogRef.current && close()}
    >
      <div className="dialogBody">
        <button type="button" className="btn btn-accent iconBtn dialogClose" aria-label="Close" onClick={close}>
          <X size={16} strokeWidth={2.5} />
        </button>

        {error && (
          <p className="errorText" role="alert">
            Couldn't load this recipe: {error}
          </p>
        )}
        {!recipe && !error && <p className="text-muted">Loading recipe…</p>}

        {recipe && (
          <>
            <RecipeImage src={recipe.image} className="recipeImageLarge" />
            <h2 id="recipe-dialog-title" className="recipeName">
              {recipe.name}
            </h2>
            <p className="text-label text-muted">
              {recipe.cuisine} · {recipe.ingredients.length} ingredients · {recipe.minutes} min
              {recipe.calories > 0 && ` · ~${recipe.calories} kcal`}
            </p>

            <h3 className="dialogHeading">Ingredients</h3>
            {recipe.ingredients.length === 0 ? (
              <p className="text-muted">No ingredients yet.</p>
            ) : (
              <ul className="ingredientList">
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient.id} className="detailRow">
                    <span>{ingredient.name}</span>
                    <span className="text-muted">
                      {ingredient.quantity} {ingredient.unit}
                    </span>
                    <span>{peso.format(ingredient.estimated_cost)}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="costTotal">
              Estimated cost: <strong>{peso.format(total)}</strong>
            </p>

            <div className="dialogActions">
              <Link className="btn btn-accent" to={`/recipes/${recipe.id}`}>
                Edit ingredients
              </Link>
              <button type="button" className="btn btn-primary" onClick={close}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
