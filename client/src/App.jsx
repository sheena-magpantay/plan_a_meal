import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import Navbar from "./sidebar.jsx";
import Home from "./screens/home.jsx";
import Recipes from "./screens/recipes.jsx";
import RecipeIngredients from "./screens/ingredients.jsx";
import ShoppingList from "./screens/shoppinglist.jsx";
import Profile from "./screens/profile.jsx";
import AuthPage from "./screens/authpage.jsx";
import { useAuth } from "./auth.jsx";
import { SUPABASE_ENABLED } from "./supabase.js";

export default function App() {
  return (
    <Routes>
      {/* Login and sign up fill the screen, without the sidebar. They only
          exist when Supabase is configured; otherwise there is nothing to
          log in to. */}
      {SUPABASE_ENABLED && (
        <>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
        </>
      )}

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeIngredients />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Every app screen needs a signed-in user. Visitors without one go to the
// login page, which sends them back here afterwards.
function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (!SUPABASE_ENABLED) return <Outlet />;
  if (loading) return <p className="authLoading text-muted">Loading…</p>;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

function Layout() {
  return (
    <>
      <Navbar />
      <div className="container">
        <header className="brand">
          <p className="brandName">Plan a Meal</p>
          <p className="brandTagline">Weekly Meal Planner</p>
        </header>
        <main className="screen">
          <Outlet />
        </main>
        <footer className="footer">© 2026 Plan A Meal. All Rights Reserved</footer>
      </div>
    </>
  );
}
