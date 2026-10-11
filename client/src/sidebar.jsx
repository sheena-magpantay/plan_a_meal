import { NavLink } from "react-router-dom";
import { BookOpen, House, ShoppingCart, User } from "lucide-react";
import logo from "./assets/logo.png";

const nav_icons = [
  { to: "/", end: true, label: "Home", Icon: House, img: logo },
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
                [
                  "item",
                  img && "itemLogo",
                  isActive && "itemActive",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {img && <img src={img} alt="" className="logoIcon" />}
              <Icon
                className={img ? "icon homeIcon" : "icon"}
                strokeWidth={1.75}
              />
              <span className={img ? "label homeLabel" : "label"}>
                {label}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
