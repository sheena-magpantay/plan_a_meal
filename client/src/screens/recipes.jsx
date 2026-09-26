import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Check, X, Plus, Sparkles } from "lucide-react";
import {
  listRecipes,
  getRecipe,
  addToMealPlan,
  createRecipe,
  deleteRecipe,
  updateRecipeIngredients,
} from "../api/index.js";
import { AI_ENABLED, generateRecipe } from "../api/ai.js";
import { storeCost, isSpoonMeasure } from "../pricing.js";
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

// The cuisine dropdown's extra choice: only recipes the user added.
const MINE = "mine";

const EMPTY_RECIPE = { name: "", cuisine: "", minutes: "", calories: "", image: "" };

export default function Recipes() {
  // ?day=Monday comes from a day's Add button on the home screen: that day is
  // preselected when choosing a day. ?recipe=5 comes from a suggested meal and
  // opens that recipe's details.
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Set by the edit screen after Save. Shown for this visit only: the effect
  // clears it from the history entry so a reload does not show it again.
  const [savedName] = useState(() => location.state?.savedRecipe ?? "");
  useEffect(() => {
    if (location.state?.savedRecipe) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location, navigate]);
  const dayParam = searchParams.get("day");
  const planningDay = DAYS.includes(dayParam) ? dayParam : "";
  const recipeParam = Number(searchParams.get("recipe"));

  const [recipes, setRecipes] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [cuisine, setCuisine] = useState(""); // "" means all cuisines, MINE means added ones
  const [creating, setCreating] = useState(false);
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
    .filter((recipe) =>
      !cuisine ? true : cuisine === MINE ? recipe.custom : recipe.cuisine === cuisine
    )
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
            <option value={MINE}>My recipes</option>
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
          <button
            type="button"
            className="btn btn-primary addRecipeBtn"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Add a recipe
          </button>
        </div>
      </div>

      {savedName && (
        <p className="planningBanner" role="status">
          Saved the ingredients for <strong>{savedName}</strong>.
        </p>
      )}

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
        <p className="text-muted">
          {cuisine === MINE && !search
            ? "You haven't added any recipes yet. Press Add a recipe to make one."
            : "No recipes match your search and filters."}
        </p>
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
          onDeleted={(id) => setRecipes((current) => current.filter((row) => row.id !== id))}
        />
      )}

      {creating && <NewRecipeDialog onClose={() => setCreating(false)} />}
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
        {recipe.custom && <span className="myRecipeTag">My recipe</span>}
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
function RecipeDetails({ recipeId, onClose, onDeleted }) {
  const dialogRef = useRef(null);
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");
  // Delete asks once more before it happens: idle -> confirming -> deleting
  const [deleteState, setDeleteState] = useState("idle");
  const [deleteError, setDeleteError] = useState("");

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

  async function remove() {
    setDeleteState("deleting");
    setDeleteError("");
    try {
      await deleteRecipe(recipe.id);
      onDeleted(recipe.id);
      close();
    } catch (err) {
      setDeleteError(`Couldn't delete: ${err.message}`);
      setDeleteState("idle");
    }
  }

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
              {recipe.servings && ` · serves ${recipe.servings}`}
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
                    {/* Cups and spoons have no cost */}
                    <span>
                      {isSpoonMeasure(ingredient.unit) ? "" : peso.format(ingredient.estimated_cost)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="costTotal">
              Estimated cost: <strong>{peso.format(total)}</strong>
            </p>

            {deleteState === "confirming" && (
              <p className="errorText deleteWarning" role="alert">
                Delete {recipe.name}? It is also taken off your weekly plan. This can't be undone.
              </p>
            )}
            {deleteError && (
              <p className="errorText" role="alert">
                {deleteError}
              </p>
            )}

            <div className="dialogActions">
              {recipe.custom &&
                (deleteState === "idle" ? (
                  <button
                    type="button"
                    className="btn btn-outline btnDanger"
                    onClick={() => setDeleteState("confirming")}
                  >
                    Delete recipe
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={deleteState === "deleting"}
                      onClick={() => setDeleteState("idle")}
                    >
                      Keep it
                    </button>
                    <button
                      type="button"
                      className="btn btnDangerSolid"
                      disabled={deleteState === "deleting"}
                      onClick={remove}
                    >
                      {deleteState === "deleting" ? "Deleting…" : "Yes, delete"}
                    </button>
                  </>
                ))}
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

function validateRecipe(form) {
  const minutes = Number(form.minutes);
  const calories = form.calories === "" ? 0 : Number(form.calories);
  if (!form.name.trim()) return "Enter the recipe's name.";
  if (!CUISINES.includes(form.cuisine)) return "Choose a cuisine.";
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return "Prep time: a whole number of minutes, 1 to 1440.";
  }
  if (!Number.isInteger(calories) || calories < 0 || calories > 10000) {
    return "Calories: a whole number, 0 to 10000.";
  }
  const image = form.image.trim();
  if (image && !/^https?:\/\//.test(image)) return "The image link must start with http:// or https://";
  return "";
}

// Pop-up for a new recipe's details. Saving opens the edit screen, where the
// ingredients go in, so there is one place to manage ingredients.
//
// With Supabase on, "Let AI suggest one" asks Gemini (through the
// generate-recipe Edge Function) for a whole recipe: it fills in the fields
// here and its ingredients are saved with the recipe, ready to check on the
// edit screen.
function NewRecipeDialog({ onClose }) {
  const dialogRef = useRef(null);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_RECIPE);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiIngredients, setAiIngredients] = useState(null); // from the last suggestion

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    // showModal focuses the first button (Close); start in the first box instead.
    dialog.querySelector("input")?.focus();
  }, []);

  const close = () => {
    dialogRef.current.close();
    onClose();
  };

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function suggest() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;

    setAiBusy(true);
    setAiError("");
    try {
      const recipe = await generateRecipe(prompt);
      setForm((current) => ({
        ...current,
        name: recipe.name,
        cuisine: recipe.cuisine,
        minutes: String(recipe.minutes),
        calories: recipe.calories ? String(recipe.calories) : "",
      }));
      // Store prices where the catalog knows the ingredient, so AI recipes
      // are costed the same way as everything else; Gemini's guess otherwise.
      setAiIngredients(
        recipe.ingredients.map((item) => ({
          ...item,
          estimated_cost: storeCost(item.name, item.quantity, item.unit) ?? item.estimated_cost,
        }))
      );
      setError("");
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const problem = validateRecipe(form);
    if (problem) return setError(problem);

    setSaving(true);
    setError("");
    let recipe;
    try {
      recipe = await createRecipe({
        name: form.name.trim(),
        cuisine: form.cuisine,
        minutes: Number(form.minutes),
        calories: form.calories === "" ? 0 : Number(form.calories),
        image: form.image.trim(),
      });
    } catch (err) {
      setError(`Couldn't save the recipe: ${err.message}`);
      setSaving(false);
      return;
    }

    if (!aiIngredients?.length) return navigate(`/recipes/${recipe.id}`);

    // The recipe exists now. If its AI ingredients cannot be saved, the edit
    // screen gets them as unsaved changes instead, so nothing is lost.
    try {
      await updateRecipeIngredients(recipe.id, aiIngredients);
      navigate(`/recipes/${recipe.id}`, { state: { ai: { saved: true } } });
    } catch (err) {
      navigate(`/recipes/${recipe.id}`, {
        state: { ai: { draft: aiIngredients, error: err.message } },
      });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="recipeDialog"
      aria-labelledby="new-recipe-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && close()}
    >
      <form className="dialogBody newRecipeForm" onSubmit={submit} noValidate>
        <button type="button" className="btn btn-accent iconBtn dialogClose" aria-label="Close" onClick={close}>
          <X size={16} strokeWidth={2.5} />
        </button>

        <h2 id="new-recipe-title" className="recipeName">
          Add a recipe
        </h2>
        <p className="text-muted newRecipeHint">
          Start with the basics. Next you'll add its ingredients.
        </p>

        {AI_ENABLED && (
          <div className="aiBox">
            <label className="aiTitle" htmlFor="ai-prompt">
              <Sparkles size={16} aria-hidden="true" /> Let AI suggest one
            </label>
            <div className="aiRow">
              <input
                id="ai-prompt"
                className="input"
                placeholder="e.g. cheap chicken dinner, 30 minutes"
                maxLength={300}
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                // Enter asks the AI instead of submitting the whole form.
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    suggest();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-accent"
                onClick={suggest}
                disabled={aiBusy || !aiPrompt.trim()}
              >
                {aiBusy ? "Thinking…" : aiIngredients ? "Try again" : "Suggest"}
              </button>
            </div>
            {aiError && (
              <p className="errorText" role="alert">
                {aiError}
              </p>
            )}
            {aiIngredients && !aiError && (
              <p className="aiNote" role="status">
                Filled in below, with {aiIngredients.length} ingredients (about{" "}
                {peso.format(aiIngredients.reduce((sum, item) => sum + item.estimated_cost, 0))}).
                Prices are AI estimates; you can check them on the next screen.
              </p>
            )}
          </div>
        )}

        <label className="fieldLabel">
          Name
          <input
            className="input"
            name="name"
            placeholder="e.g. Lola's Pancit Canton"
            maxLength={120}
            value={form.name}
            onChange={updateField}
          />
        </label>

        <div className="fieldRow">
          <label className="fieldLabel">
            Cuisine
            <select className="input" name="cuisine" value={form.cuisine} onChange={updateField}>
              <option value="" disabled>
                Choose one
              </option>
              {CUISINES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="fieldLabel">
            Prep time (min)
            <input
              className="input"
              name="minutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              placeholder="30"
              value={form.minutes}
              onChange={updateField}
            />
          </label>
          <label className="fieldLabel">
            Calories (optional)
            <input
              className="input"
              name="calories"
              type="number"
              min="0"
              step="1"
              placeholder="per serving"
              value={form.calories}
              onChange={updateField}
            />
          </label>
        </div>

        <label className="fieldLabel">
          Image link (optional)
          <input
            className="input"
            name="image"
            type="url"
            placeholder="https://…"
            maxLength={500}
            value={form.image}
            onChange={updateField}
          />
        </label>

        {error && (
          <p className="errorText" role="alert">
            {error}
          </p>
        )}

        <div className="dialogActions">
          <button type="button" className="btn btn-outline" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Next: add ingredients"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
