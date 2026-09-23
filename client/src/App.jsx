import { Routes, Route } from "react-router-dom";
import Navbar from "./sidebar.jsx";
import Home from "./screens/home.jsx";
import Recipes from "./screens/recipes.jsx";
import RecipeIngredients from "./screens/ingredients.jsx";
import ShoppingList from "./screens/shoppinglist.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeIngredients />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/profile" element={<p>Profile</p>} />
        </Routes>
      </div>
    </>
  );
}