import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Minus, X } from "lucide-react";
import {
  getShoppingList,
  setShoppingItemChecked,
  setShoppingItemQuantity,
  addShoppingItem,
  removeShoppingItem,
} from "../api/index.js";
import { peso } from "../format.js";
import { currentWeekStart, formatWeekRange } from "../week.js";
import { CATEGORY_ORDER, categorize } from "../categories.js";
import { costToBuy } from "../shopping.js";

// The filter tabs above the list. The summary and Download always cover the
// whole list; the filter only changes what is shown.
const FILTERS = {
  all: { label: "All", test: () => true, empty: "" },
  unchecked: {
    label: "To buy",
    test: (item) => !item.checked,
    empty: "Everything is checked off.",
  },
  checked: { label: "Checked", test: (item) => item.checked, empty: "Nothing checked yet." },
};

const EMPTY_ITEM = { name: "", quantity: "", unit: "" };

// Suggestions for the unit box; any other unit can be typed.
const UNITS = ["pc", "pack", "bottle", "can", "sachet", "bundle", "dozen", "kg", "g", "L", "ml", "bunch", "head"];

const byName = (a, b) => a.name.localeCompare(b.name);

function groupByCategory(items) {
  return CATEGORY_ORDER.map((category) => [
    category,
    // Store products carry their own category; typed-in ingredients the
    // catalog does not know are sorted by name.
    items.filter((item) => (item.category ?? categorize(item.name)) === category),
  ]).filter(([, list]) => list.length > 0);
}

// Saves the list as a plain text file, grouped the same way as the screen.
function downloadList(items, weekStart) {
  const total = costToBuy(items);
  const lines = ["Plan a Meal: Grocery List", `Week of ${formatWeekRange(weekStart)}`, ""];

  for (const [category, list] of groupByCategory(items)) {
    lines.push(category.toUpperCase());
    for (const item of list) {
      const box = item.checked ? "[x]" : "[ ]";
      lines.push(`${box} ${item.name}, ${item.amount}, ${peso.format(item.estimated_cost)}`);
    }
    lines.push("");
  }
  lines.push(`Quantity: ${items.length} items`, `Total cost: ${peso.format(total)}`);

  // The BOM makes older Windows Notepad read the peso sign correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `grocery-list-${weekStart}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ShoppingList() {
  const [weekStart] = useState(currentWeekStart);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [filter, setFilter] = useState("all");
  const [removingKey, setRemovingKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null); // item whose quantity is saving

  useEffect(() => {
    let cancelled = false;
    getShoppingList(weekStart)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
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

  // Ticks show immediately and are saved in the background; if saving fails,
  // the tick is undone and the error shown.
  async function toggle(item) {
    const checked = !item.checked;
    const setChecked = (value) =>
      setItems((current) =>
        current.map((row) => (row.key === item.key ? { ...row, checked: value } : row))
      );

    setChecked(checked);
    setSaveError("");
    try {
      await setShoppingItemChecked({ week_start: weekStart, item_key: item.key, checked });
    } catch (err) {
      setChecked(!checked);
      setSaveError(`Couldn't save that: ${err.message}`);
    }
  }

  // quantity is in the item's buying unit; null goes back to the suggestion.
  // The whole list is reloaded after, because the cost is worked out from the
  // store prices on the server side of the API (server/db/shoppingList.js).
  async function changeQuantity(item, quantity) {
    setSavingKey(item.key);
    setSaveError("");
    try {
      await setShoppingItemQuantity({ week_start: weekStart, item_key: item.key, quantity });
      setItems(await getShoppingList(weekStart));
    } catch (err) {
      setSaveError(`Couldn't change ${item.name}: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  }

  async function remove(item) {
    setRemovingKey(item.key);
    setSaveError("");
    try {
      await removeShoppingItem(item.id);
      setItems((current) => current.filter((row) => row.key !== item.key));
    } catch (err) {
      setSaveError(`Couldn't remove ${item.name}: ${err.message}`);
    } finally {
      setRemovingKey(null);
    }
  }

  if (status === "loading") return <p className="text-muted">Loading your list…</p>;
  if (status === "error") {
    return (
      <p className="errorText" role="alert">
        Couldn't load your list: {error}
      </p>
    );
  }

  const checkedCount = items.filter((item) => item.checked).length;
  const total = costToBuy(items);
  const counts = {
    all: items.length,
    unchecked: items.length - checkedCount,
    checked: checkedCount,
  };
  const shown = items.filter(FILTERS[filter].test);

  return (
    <section>
      <div className="pageHeader">
        <div>
          <h1>Grocery List</h1>
          <p className="text-label text-muted">This week · {formatWeekRange(weekStart)}</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          disabled={items.length === 0}
          onClick={() => downloadList(items, weekStart)}
        >
          <Download size={16} aria-hidden="true" /> Download List
        </button>
      </div>

      {saveError && (
        <p className="errorText" role="alert">
          {saveError}
        </p>
      )}

      <AddItemForm
        weekStart={weekStart}
        onAdded={(item) => {
          setItems((current) => [...current, item].sort(byName));
          // A new item is unchecked; make sure it is visible.
          if (filter === "checked") setFilter("all");
        }}
      />

      {items.length === 0 ? (
        <div className="emptyState">
          <p>Your list is empty.</p>
          <p className="text-muted">
            Add recipes to this week's plan and their ingredients show up here, or add an item
            above.
          </p>
          <Link className="btn btn-primary" to="/recipes">
            Browse recipes
          </Link>
        </div>
      ) : (
        <>
          <div className="filterTabs" role="group" aria-label="Show items">
            {Object.entries(FILTERS).map(([value, { label }]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "filterTab isActive" : "filterTab"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} <span className="filterCount">{counts[value]}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 && <p className="text-muted">{FILTERS[filter].empty}</p>}

          <div className="groceryGroups">
            {groupByCategory(shown).map(([category, list]) => (
              <section key={category} className="groceryGroup">
                <h2 className="groceryCategory">{category}</h2>
                <ul className="groceryList">
                  {list.map((item) => (
                    <li
                      key={item.key}
                      className={item.checked ? "groceryItem isChecked" : "groceryItem"}
                    >
                      <label className="groceryLabel">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggle(item)}
                        />
                        <span>
                          <span className="groceryName">{item.name}</span>
                          {/* A ticked item is done: only its crossed-out name stays. */}
                          {!item.checked && (
                            <span className="groceryFor text-muted">
                              {item.custom ? "Added by you" : `For ${item.recipes.join(", ")}`}
                              {item.uses && ` · ${item.uses}`}
                            </span>
                          )}
                        </span>
                      </label>
                      {!item.checked && (
                        <>
                          <span className="groceryQty">
                            <QuantityEditor
                              item={item}
                              saving={savingKey === item.key}
                              onChange={(quantity) => changeQuantity(item, quantity)}
                            />
                          </span>
                          <span className="groceryCost">
                            {item.priced === false ? (
                              <span className="text-muted" title="No price estimate for this item">
                                —
                              </span>
                            ) : (
                              peso.format(item.estimated_cost)
                            )}
                          </span>
                        </>
                      )}
                      {/* Only items added by hand can be removed; recipe items
                          leave when their recipe leaves the plan. */}
                      {item.custom ? (
                        <button
                          type="button"
                          className="groceryRemove"
                          aria-label={`Remove ${item.name}`}
                          disabled={removingKey === item.key}
                          onClick={() => remove(item)}
                        >
                          <X size={16} strokeWidth={2.5} />
                        </button>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="grocerySummary">
            <p>
              Quantity: <strong>{items.length} items</strong> ({checkedCount} checked)
            </p>
            <p>
              Total cost: <strong>{peso.format(total)}</strong>
            </p>
            <p className="text-muted priceNote">
              Costs are estimates from typical Philippine supermarket and palengke prices. Change
              an amount with − and +, or type it in.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

// One row: name, quantity, unit, Add. Only the name is required; quantity
// defaults to 1 and unit to pieces. There is no cost box: the app prices it.
function AddItemForm({ weekStart, onAdded }) {
  const [form, setForm] = useState(EMPTY_ITEM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const quantity = form.quantity === "" ? 1 : Number(form.quantity);

    if (!name) return setError("Enter the item's name.");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      return setError("Enter a quantity above 0.");
    }

    setSaving(true);
    setError("");
    try {
      // The cost is the app's: store prices, or an AI estimate for anything
      // the store list does not know (see addShoppingItem in src/api).
      const item = await addShoppingItem({
        week_start: weekStart,
        name,
        quantity,
        unit: form.unit.trim(),
      });
      onAdded(item);
      setForm(EMPTY_ITEM);
    } catch (err) {
      setError(`Couldn't add that: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card addItemForm" onSubmit={submit} noValidate>
      <input
        className="input addItemName"
        name="name"
        placeholder="Add an item, e.g. Dishwashing liquid"
        aria-label="Item name"
        maxLength={120}
        value={form.name}
        onChange={updateField}
      />
      <input
        className="input"
        name="quantity"
        type="number"
        min="0"
        step="any"
        placeholder="Qty"
        aria-label="Quantity"
        value={form.quantity}
        onChange={updateField}
      />
      <input
        className="input"
        name="unit"
        list="unit-options"
        placeholder="Unit"
        aria-label="Unit"
        maxLength={20}
        value={form.unit}
        onChange={updateField}
      />
      <datalist id="unit-options">
        {UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> {saving ? "Pricing…" : "Add"}
      </button>
      {error && (
        <p className="errorText addItemError" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// − [ 2 ] + bottles, with what that buys underneath ("2 bottles (385 ml
// each)"). The buttons move by one step: a bottle, 6 eggs, 0.1 kg of meat.
// A typed amount is saved on Enter or when the box loses focus.
function QuantityEditor({ item, saving, onChange }) {
  const [draft, setDraft] = useState(String(item.quantity));

  useEffect(() => {
    setDraft(String(item.quantity));
  }, [item.quantity]);

  const tidy = (value) => Math.round(value * 1000) / 1000;

  function commit() {
    const quantity = tidy(Number(draft));
    if (!Number.isFinite(quantity) || quantity <= 0) return setDraft(String(item.quantity));
    if (quantity !== item.quantity) onChange(quantity);
  }

  function stepBy(direction) {
    const next = tidy(item.quantity + direction * item.step);
    if (next <= 0) return;
    setDraft(String(next));
    onChange(next);
  }

  return (
    <span className="qtyEditor">
      <span className="qtyControls">
        <button
          type="button"
          className="qtyBtn"
          aria-label={`Less ${item.name}`}
          disabled={saving || item.quantity - item.step <= 0}
          onClick={() => stepBy(-1)}
        >
          <Minus size={14} strokeWidth={2.5} />
        </button>
        <input
          type="number"
          className="qtyInput"
          aria-label={`${item.name}, amount in ${item.unit}`}
          min={item.step}
          step={item.step}
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <button
          type="button"
          className="qtyBtn"
          aria-label={`More ${item.name}`}
          disabled={saving}
          onClick={() => stepBy(1)}
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
        <span className="qtyUnit">{item.unit}</span>
      </span>
      <span className="qtyAmount text-muted">
        {item.amount}
        {item.edited && (
          <>
            {" · "}
            <button
              type="button"
              className="linkBtn"
              disabled={saving}
              onClick={() => onChange(null)}
              title={`Back to the suggested ${item.suggested_quantity} ${item.unit}`}
            >
              Reset
            </button>
          </>
        )}
      </span>
    </span>
  );
}
