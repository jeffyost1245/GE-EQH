"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentCrew } from "@/lib/tenant";
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
  { href: "/fleet", Icon: MachinesIcon, label: "Fleet" },
  { href: "/overview", Icon: DashboardIcon, label: "Crews" },
  { href: "/maintenance", Icon: LogIcon, label: "Repairs" },
  { href: "/sheets", Icon: EntriesIcon, label: "Sheets" },
];

// The office has one screen, so the bar is really just a label — but
// leaving it out would make the page look like it had lost its footing.
const OWNER_TABS = [{ href: "/people", Icon: CrewIcon, label: "People" }];

export default function Nav() {
  const pathname = usePathname();
  const [tabs, setTabs] = useState(CREW_TABS);

  useEffect(() => {
    const role = currentCrew()?.role;
    if (role === "superintendent") setTabs(SUPER_TABS);
    else if (role === "owner") setTabs(OWNER_TABS);
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
