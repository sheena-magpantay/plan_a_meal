import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, X } from "lucide-react";
import {
  getShoppingList,
  setShoppingItemChecked,
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

const EMPTY_ITEM = { name: "", amount: "", estimated_cost: "" };

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
                          <span className="groceryFor text-muted">
                            {item.custom ? "Added by you" : `For ${item.recipes.join(", ")}`}
                            {item.uses && ` · ${item.uses}`}
                          </span>
                        </span>
                      </label>
                      <span className="groceryQty text-muted">{item.amount}</span>
                      <span className="groceryCost">{peso.format(item.estimated_cost)}</span>
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
          </div>
        </>
      )}
    </section>
  );
}

// One row: name, amount, cost, Add. Only the name is required.
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
    const cost = form.estimated_cost === "" ? 0 : Number(form.estimated_cost);

    if (!name) return setError("Enter the item's name.");
    if (!Number.isFinite(cost) || cost < 0) return setError("Enter a cost of 0 or more.");

    setSaving(true);
    setError("");
    try {
      const item = await addShoppingItem({
        week_start: weekStart,
        name,
        amount: form.amount.trim(),
        estimated_cost: cost,
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
        name="amount"
        placeholder="Amount (e.g. 2 packs)"
        aria-label="Amount"
        maxLength={40}
        value={form.amount}
        onChange={updateField}
      />
      <input
        className="input"
        name="estimated_cost"
        type="number"
        min="0"
        step="0.01"
        placeholder="Cost (₱)"
        aria-label="Estimated cost in pesos"
        value={form.estimated_cost}
        onChange={updateField}
      />
      <button type="submit" className="btn btn-primary" disabled={saving}>
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> {saving ? "Adding…" : "Add"}
      </button>
      {error && (
        <p className="errorText addItemError" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
