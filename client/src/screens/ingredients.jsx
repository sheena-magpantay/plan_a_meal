import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRecipe, updateRecipeIngredients } from "../api/index.js";
import { peso } from "../format.js";

const EMPTY_FORM = { name: "", estimated_cost: "", quantity: "", unit: "" };

// Each row needs a stable React key. Saved rows have an id; rows added on this
// screen do not until Save, so they get a temporary one.
const withKey = (ingredient) => ({
  ...ingredient,
  key: ingredient.id ? String(ingredient.id) : crypto.randomUUID(),
});

export default function RecipeIngredients() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved | error
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getRecipe(id)
      .then((row) => {
        if (cancelled) return;
        setRecipe(row);
        setIngredients(row.ingredients.map(withKey));
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

  function addIngredient(event) {
    event.preventDefault();
    const name = form.name.trim();
    const quantity = Number(form.quantity);
    const cost = Number(form.estimated_cost);

    if (!name) return setFormError("Enter an ingredient name.");
    if (form.estimated_cost === "" || !Number.isFinite(cost) || cost < 0) {
      return setFormError("Enter an estimated cost of 0 or more.");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return setFormError("Enter a quantity above 0.");
    }

    setIngredients([
      ...ingredients,
      withKey({ name, quantity, unit: form.unit.trim(), estimated_cost: cost }),
    ]);
    setForm(EMPTY_FORM);
    setFormError("");
    setSaveState("dirty");
  }

  function removeIngredient(key) {
    setIngredients(ingredients.filter((ingredient) => ingredient.key !== key));
    setSaveState("dirty");
  }

  async function save() {
    setSaveState("saving");
    setSaveError("");
    try {
      const updated = await updateRecipeIngredients(
        id,
        ingredients.map(({ name, quantity, unit, estimated_cost }) => ({
          name,
          quantity,
          unit,
          estimated_cost,
        }))
      );
      setIngredients(updated.ingredients.map(withKey));
      setSaveState("saved");
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
            disabled={saveState === "saving"}
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
            name="estimated_cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="Estimated cost (₱)"
            aria-label="Estimated cost in pesos"
            value={form.estimated_cost}
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
            placeholder="Unit (g, pc, cup…)"
            aria-label="Unit"
            value={form.unit}
            onChange={updateField}
          />
          {formError && (
            <p className="errorText" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-accent">
            Add an ingredient
          </button>
        </form>

        <div>
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
                  <span>{peso.format(ingredient.estimated_cost)}</span>
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
        </div>
      </div>
    </section>
  );
}
