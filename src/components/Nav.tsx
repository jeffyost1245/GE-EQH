"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "📊", label: "Dashboard" },
  { href: "/log", icon: "➕", label: "Log Hours" },
  { href: "/entries", icon: "📋", label: "Entries" },
  { href: "/machines", icon: "🚜", label: "Machines" },
  { href: "/crew", icon: "👷", label: "Crew" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {TABS.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <span className="nav-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
