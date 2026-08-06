"use client";

// The company's iron, on one board.
//
// Built to answer one question quickly: what excavator is free. Machines
// that have been sitting come first inside each group, and the board
// gives the number of working days rather than only a label — that is
// what lets Spoon tell a machine staged for Monday from one that is
// genuinely spare.
//
// Nothing on this screen is maintained by hand. It is hours and checkout
// sheets, read sideways.

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import FleetBoard from "@/components/FleetBoard";
import { allMachines, fleetActivity, fleetInspections } from "@/lib/data";
import { FleetRow, IDLE_THRESHOLD, buildFleet } from "@/lib/fleet";
import { MACHINE_TYPES } from "@/lib/machineTypes";
import { Machine } from "@/lib/types";
import { toDateString, todayString } from "@/lib/week";

/** How far back to look. Beyond this a machine is idle either way. */
const WINDOW_DAYS = 90;

export default function FleetPage() {
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);
    const sinceStr = toDateString(since);

    Promise.all([
      allMachines(),
      fleetActivity(sinceStr),
      // No inspections yet: the board still works off hours alone, it
      // just cannot say where anything is.
      fleetInspections(sinceStr).catch(() => []),
    ])
      .then(([machines, activity, sheets]) => {
        const active = (
          machines as (Machine & { foremen?: { name: string } | null })[]
        ).filter((m) => m.status === "active");
        setRows(buildFleet(active, activity, sheets, todayString()));
      })
      .catch(() => setError("Can't reach the server — check your signal."));
  }, []);

  const untyped = (rows ?? []).filter(
    (r) => !MACHINE_TYPES.some((t) => t.key === r.machine.machine_type)
  ).length;

  return (
    <AppShell title="Fleet">
      <CrewBar />
      {error && <p className="notice">{error}</p>}
      {!rows && !error && <p className="muted">Reading the fleet…</p>}

      {rows && <FleetBoard rows={rows} />}

      {untyped > 0 && (
        <p className="notice">
          {untyped} {untyped === 1 ? "machine has" : "machines have"} no type
          yet, so {untyped === 1 ? "it sits" : "they sit"} at the bottom
          instead of with the rest of its kind. A foreman sets it on the
          Machines screen.
        </p>
      )}

      <p className="small muted">
        A machine reads as available once it has sat {IDLE_THRESHOLD} working
        days — Sundays don&apos;t count — and nothing is flagged on it.
        Anything with an open repair reads DOWN however long it has sat.{" "}
        <Link href="/maintenance">See the repair list</Link>.
      </p>
    </AppShell>
  );
}
