import { Link } from "@tanstack/react-router";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/cards", label: "Cards" },
  { to: "/best", label: "Best" },
  { to: "/compare", label: "Compare" },
  { to: "/about", label: "About" },
] as const;


export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2 focus-ring rounded-md" aria-label="UFL Mobile Card Database home">
          <span className="brand-mark" aria-hidden>
            U
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.14em] sm:text-base">
            UFL <span className="text-accent">Cards</span>
          </span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="nav-link focus-ring"
                  activeOptions={{ exact: item.to === "/" }}
                  activeProps={{ "data-active": "true" }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
