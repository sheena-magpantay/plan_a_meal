import { NavLink } from "react-router-dom";
import { BookOpen, ShoppingCart, User } from "lucide-react";
import logo from "./assets/logo.png";

const nav_icons = [
  { to: "/", end: true, img: logo },
  { to: "/recipes", label: "Recipes", Icon: BookOpen },
  { to: "/shopping-list", label: "Shopping list", Icon: ShoppingCart },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <ul className="list">
        {nav_icons.map(({ to, label, end, Icon, img }) => (
          <li key={to} className="listItem">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                img ? "item itemLogo" : isActive ? "item itemActive" : "item"
              }
            >
              {img ? (
                <img src={img} alt="" className="logoIcon" />
              ) : (
                <Icon className="icon" strokeWidth={1.75} />
              )}
              {label && <span className="label">{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
