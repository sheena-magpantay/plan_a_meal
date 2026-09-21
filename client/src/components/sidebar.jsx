import { NavLink } from "react-router-dom";
import { Home, BookOpen, ShoppingCart, User } from "lucide-react";
import styles from "./Sidebar.module.css";

const nav_icons = [
  { to: "/", label: "Home", end: true, Icon: Home },
  { to: "/recipes", label: "Recipes", Icon: BookOpen },
  { to: "/shopping-list", label: "Shopping list", Icon: ShoppingCart },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function Sidebar() {
  return (
    <nav className={styles.sidebar}>
      <ul className={styles.list}>
        {nav_icons.map(({ to, label, end, Icon }) => (
          <li key={to} className={styles.listItem}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? `${styles.item} ${styles.itemActive}` : styles.item
              }
            >
              <Icon className={styles.icon} strokeWidth={1.75} />
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
