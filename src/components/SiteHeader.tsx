import { Link } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  Trophy,
  Scale,
  Clock,
  Heart,
  BarChart3,
  ScrollText,
  Info,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  full: string;
  icon: LucideIcon;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Home", full: "Home", icon: Home, exact: true },
  { to: "/cards", label: "Cards", full: "Cards", icon: LayoutGrid },
  { to: "/best", label: "Best", full: "Best players", icon: Trophy },
  { to: "/compare", label: "Compare", full: "Compare cards", icon: Scale },
  { to: "/recent", label: "New", full: "Recently changed", icon: Clock },
  { to: "/favorites", label: "Favs", full: "Favorites", icon: Heart },
  { to: "/stats", label: "Stats", full: "Statistics", icon: BarChart3 },
  { to: "/changelog", label: "News", full: "What's new", icon: ScrollText },
  { to: "/about", label: "About", full: "About", icon: Info },
  { to: "/settings", label: "Admin", full: "Admin settings", icon: Settings },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-2.5">
        <Link
          to="/"
          className="focus-ring flex shrink-0 items-center gap-2 rounded-md"
          aria-label="UFLBase home"
        >
          <span className="brand-mark" aria-hidden>
            U
          </span>
          <span className="hidden text-sm font-bold uppercase tracking-[0.14em] sm:inline sm:text-base">
            UFL<span className="text-accent">Base</span>
          </span>
        </Link>

        <nav aria-label="Main" className="min-w-0 flex-1">
          <ul className="flex items-center justify-end gap-0.5 sm:gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="nav-link focus-ring"
                    title={item.full}
                    aria-label={item.full}
                    activeOptions={{ exact: item.exact === true }}
                    activeProps={{ "data-active": "true" }}
                  >
                    <Icon className="size-[1.05rem] shrink-0" aria-hidden />
                    <span className="nav-link-label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
