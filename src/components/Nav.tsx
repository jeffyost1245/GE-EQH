"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSuperintendent } from "@/lib/tenant";
import {
  CrewIcon,
  DashboardIcon,
  EntriesIcon,
  LogIcon,
  MachinesIcon,
} from "./NavIcons";

const CREW_TABS = [
  { href: "/", Icon: DashboardIcon, label: "Dashboard" },
  { href: "/log", Icon: LogIcon, label: "Log Hours" },
  { href: "/entries", Icon: EntriesIcon, label: "Entries" },
  { href: "/machines", Icon: MachinesIcon, label: "Machines" },
  { href: "/crew", Icon: CrewIcon, label: "Crew" },
];

// A superintendent reads across crews and acts only on maintenance, so
// the crew-scoped tabs would only lead to redirects.
const SUPER_TABS = [
  { href: "/overview", Icon: DashboardIcon, label: "Overview" },
  { href: "/maintenance", Icon: MachinesIcon, label: "Maintenance" },
  { href: "/sheets", Icon: EntriesIcon, label: "Sheets" },
];

export default function Nav() {
  const pathname = usePathname();
  const [tabs, setTabs] = useState(CREW_TABS);

  useEffect(() => {
    if (isSuperintendent()) setTabs(SUPER_TABS);
  }, []);

  return (
    <nav className="nav">
      {tabs.map(({ href, Icon, label }) => {
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
