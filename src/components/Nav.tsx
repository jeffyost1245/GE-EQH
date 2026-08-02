"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CrewIcon,
  DashboardIcon,
  EntriesIcon,
  LogIcon,
  MachinesIcon,
} from "./NavIcons";

const TABS = [
  { href: "/", Icon: DashboardIcon, label: "Dashboard" },
  { href: "/log", Icon: LogIcon, label: "Log Hours" },
  { href: "/entries", Icon: EntriesIcon, label: "Entries" },
  { href: "/machines", Icon: MachinesIcon, label: "Machines" },
  { href: "/crew", Icon: CrewIcon, label: "Crew" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {TABS.map(({ href, Icon, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "active" : ""}>
            <span className="nav-icon">
              <Icon />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
