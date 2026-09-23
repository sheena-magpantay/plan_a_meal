import { NavLink } from "react-router-dom";
import { Home, BookOpen, ShoppingCart, User } from "lucide-react";


const nav_icons = [
  { to: "/", label: "Home", end: true, Icon: Home },
  { to: "/recipes", label: "Recipes", Icon: BookOpen },
  { to: "/shopping-list", label: "Shopping list", Icon: ShoppingCart },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <ul className="list">
        {nav_icons.map(({ to, label, end, Icon }) => (
          <li key={to} className="listItem">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? "item itemActive" : "item"
              }
            >
              <Icon className="icon" strokeWidth={1.75} />
              <span className="label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
