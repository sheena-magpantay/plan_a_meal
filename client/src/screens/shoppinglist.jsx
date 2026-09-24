import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { getShoppingList, setShoppingItemChecked } from "../api/index.js";
import { peso } from "../format.js";
import { currentWeekStart, formatWeekRange } from "../week.js";
import { CATEGORY_ORDER, categorize } from "../categories.js";
import { costToBuy } from "../shopping.js";

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

      {items.length === 0 ? (
        <div className="emptyState">
          <p>Your list is empty.</p>
          <p className="text-muted">
            Add recipes to this week's plan and their ingredients show up here.
          </p>
          <Link className="btn btn-primary" to="/recipes">
            Browse recipes
          </Link>
        </div>
      ) : (
        <>
          <div className="groceryGroups">
            {groupByCategory(items).map(([category, list]) => (
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
                            For {item.recipes.join(", ")}
                            {item.uses && ` · ${item.uses}`}
                          </span>
                        </span>
                      </label>
                      <span className="groceryQty text-muted">{item.amount}</span>
                      <span className="groceryCost">{peso.format(item.estimated_cost)}</span>
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
