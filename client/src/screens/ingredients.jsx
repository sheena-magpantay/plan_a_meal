import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { getRecipe, updateRecipeIngredients } from "../api/index.js";
import { peso } from "../format.js";
import { priceIngredient, isSpoonMeasure } from "../pricing.js";

const EMPTY_FORM = { name: "", quantity: "", unit: "" };

// Suggestions for the unit box; any other unit can be typed.
const UNITS = ["g", "kg", "ml", "L", "cup", "tbsp", "tsp", "pc", "clove", "head", "bunch", "can", "pack", "bottle", "stalk", "slice"];

const MAX_SERVINGS = 100;

const round2 = (value) => Math.round(value * 100) / 100;

// Each row needs a stable React key. Saved rows have an id; rows added on this
// screen do not until Save, so they get a temporary one.
//
// A row keeps its amount and cost as entered for `servings` people. What is
// shown is scaled to the servings chosen now, always from those numbers, so
// going 4 -> 6 -> 4 people gives back exactly what was there.
const toRow = (ingredient, servings) => ({
  key: ingredient.id ? String(ingredient.id) : crypto.randomUUID(),
  name: ingredient.name,
  unit: ingredient.unit,
  base: { quantity: ingredient.quantity, cost: ingredient.estimated_cost, servings },
});

// The row's amount and cost for `servings` people. Cups and spoons have no
// cost (see isSpoonMeasure in server/db/shoppingList.js).
function scaled(row, servings) {
  const factor = servings / row.base.servings;
  return {
    name: row.name,
    unit: row.unit,
    quantity: round2(row.base.quantity * factor),
    estimated_cost: isSpoonMeasure(row.unit) ? 0 : round2(row.base.cost * factor),
  };
}

export default function RecipeIngredients() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // Set when arriving from "Let AI suggest one" (see NewRecipeDialog in
  // recipes.jsx): { saved: true }, or { draft, error } if saving failed.
  // Kept for this visit only; the effect below clears it from the history
  // entry so a reload does not show the notice again.
  const [ai] = useState(() => location.state?.ai);

  useEffect(() => {
    if (location.state?.ai) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const [recipe, setRecipe] = useState(null);
  const [rows, setRows] = useState([]);
  const [servings, setServings] = useState(4);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);

  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved | error
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getRecipe(id)
      .then((row) => {
        if (cancelled) return;
        const serves = row.servings ?? 4;
        setRecipe(row);
        setServings(serves);
        if (ai?.draft && row.ingredients.length === 0) {
          // The AI's ingredients could not be saved: offer them as unsaved
          // changes, so one press of Save keeps them.
          setRows(ai.draft.map((ingredient) => toRow(ingredient, serves)));
          setSaveState("dirty");
        } else {
          setRows(row.ingredients.map((ingredient) => toRow(ingredient, serves)));
        }
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
  }, [id]);

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function changeServings(next) {
    if (!Number.isInteger(next) || next < 1 || next > MAX_SERVINGS || next === servings) return;
    setServings(next);
    setSaveState("dirty");
  }

  async function addIngredient(event) {
    event.preventDefault();
    const name = form.name.trim();
    const quantity = Number(form.quantity);
    const unit = form.unit.trim();

    if (!name) return setFormError("Enter an ingredient name.");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return setFormError("Enter a quantity above 0.");
    }

    // The cost is the app's, not typed in (see src/pricing.js). The amount
    // entered is for the servings shown now.
    setAdding(true);
    setFormError("");
    const estimated_cost = (await priceIngredient({ name, quantity, unit })) ?? 0;
    setRows((current) => [...current, toRow({ name, quantity, unit, estimated_cost }, servings)]);
    setForm(EMPTY_FORM);
    setAdding(false);
    setSaveState("dirty");
  }

  function removeIngredient(key) {
    setRows(rows.filter((row) => row.key !== key));
    setSaveState("dirty");
  }

  async function save() {
    setSaveState("saving");
    setSaveError("");
    try {
      await updateRecipeIngredients(
        id,
        rows.map((row) => scaled(row, servings)),
        servings
      );
      setSaveState("saved");
      // Back to the list, which reloads and shows the new count and cost.
      // On failure it stays here with the error, so no edits are lost.
      navigate("/recipes", { state: { savedRecipe: recipe.name } });
    } catch (err) {
      setSaveError(err.message);
      setSaveState("error");
    }
  }

  if (status === "loading") return <p className="text-muted">Loading recipe…</p>;

  if (status === "error") {
    return (
      <div>
        <p className="errorText" role="alert">
          Couldn't load this recipe: {error}
        </p>
        <Link className="btn btn-outline" to="/recipes">
          Back to recipes
        </Link>
      </div>
    );
  }

  const ingredients = rows.map((row) => ({ key: row.key, ...scaled(row, servings) }));
  const total = ingredients.reduce((sum, ingredient) => sum + ingredient.estimated_cost, 0);

  return (
    <section>
      <div className="pageHeader">
        <div>
          <h1>{recipe.name}</h1>
          <p className="text-label text-muted">
            {recipe.cuisine} · {recipe.minutes} min
          </p>
        </div>
        <div className="headerActions">
          <span className="saveStatus text-muted" role="status">
            {saveState === "dirty" && "Unsaved changes"}
            {saveState === "saved" && "Saved"}
          </span>
          <Link className="btn btn-outline" to="/recipes">
            Back to recipes
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saveState === "saving" || adding}
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveState === "error" && (
        <p className="errorText" role="alert">
          Couldn't save: {saveError}
        </p>
      )}

      {ai && (
        <p className="planningBanner" role="status">
          {ai.error
            ? `AI suggested these ingredients, but they aren't saved yet (${ai.error}). Check them, then press Save.`
            : "AI suggested these ingredients and they're saved. Prices are estimates: change anything that looks off, then press Save."}
        </p>
      )}

      <h2 className="text-title">Edit the ingredients</h2>

      <div className="editor">
        <form className="card ingredientForm" onSubmit={addIngredient} noValidate>
          <input
            className="input"
            name="name"
            placeholder="Ingredient name"
            aria-label="Ingredient name"
            value={form.name}
            onChange={updateField}
          />
          <input
            className="input"
            name="quantity"
            type="number"
            min="0"
            step="any"
            placeholder="Quantity"
            aria-label="Quantity"
            value={form.quantity}
            onChange={updateField}
          />
          <input
            className="input"
            name="unit"
            list="ingredient-units"
            placeholder="Unit (g, pc, cup…)"
            aria-label="Unit"
            maxLength={20}
            value={form.unit}
            onChange={updateField}
          />
          <datalist id="ingredient-units">
            {UNITS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          {formError && (
            <p className="errorText" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-accent" disabled={adding}>
            {adding ? "Pricing…" : "Add an ingredient"}
          </button>
          <p className="text-muted formHint">
            The cost is worked out for you from typical Philippine store prices. Cups and spoons
            have no cost.
          </p>
        </form>

        <div>
          <ServingsPicker servings={servings} onChange={changeServings} />

          {ingredients.length === 0 ? (
            <p className="text-muted">No ingredients yet. Add one with the form.</p>
          ) : (
            <ul className="ingredientList">
              {ingredients.map((ingredient) => (
                <li key={ingredient.key} className="ingredientRow">
                  <span>{ingredient.name}</span>
                  <span className="text-muted">
                    {ingredient.quantity} {ingredient.unit}
                  </span>
                  <span className="ingredientCost">
                    {isSpoonMeasure(ingredient.unit) ? (
                      ""
                    ) : ingredient.estimated_cost > 0 ? (
                      peso.format(ingredient.estimated_cost)
                    ) : (
                      <span className="text-muted" title="No price estimate for this ingredient">
                        —
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    aria-label={`Remove ${ingredient.name}`}
                    onClick={() => removeIngredient(ingredient.key)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="costTotal">
            Cost: <strong>{peso.format(total)}</strong>
          </p>
          <p className="text-muted priceNote">
            For {servings} {servings === 1 ? "person" : "people"}, from typical Philippine
            supermarket and palengke prices. Ingredients measured in cups or spoons are not
            counted.
          </p>
        </div>
      </div>
    </section>
  );
}

// Serves − [ 4 ] + people. The buttons move by one; a typed number is used on
// Enter or when the box loses focus.
function ServingsPicker({ servings, onChange }) {
  const [draft, setDraft] = useState(String(servings));

  useEffect(() => {
    setDraft(String(servings));
  }, [servings]);

  function commit() {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= 1 && next <= MAX_SERVINGS) onChange(next);
    else setDraft(String(servings)); // not a usable number: put it back
  }

  return (
    <div className="servingsPicker">
      <span id="servings-label">Serves</span>
      <button
        type="button"
        className="qtyBtn"
        aria-label="Fewer people"
        disabled={servings <= 1}
        onClick={() => onChange(servings - 1)}
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <input
        className="qtyInput"
        type="number"
        min="1"
        max={MAX_SERVINGS}
        step="1"
        aria-labelledby="servings-label"
        aria-describedby="servings-people"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      />
      <button
        type="button"
        className="qtyBtn"
        aria-label="More people"
        disabled={servings >= MAX_SERVINGS}
        onClick={() => onChange(servings + 1)}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
      <span id="servings-people">{servings === 1 ? "person" : "people"}</span>
    </div>
  );
}
