"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import WeeklySheets from "@/components/WeeklySheets";
import { entriesForWeek } from "@/lib/data";
import { currentWeekRange, formatDate, formatHours } from "@/lib/week";
import { EntryWithNames } from "@/lib/types";

interface Totals {
  name: string;
  hours: number;
  open: number;
}

function tally(
  entries: EntryWithNames[],
  key: (e: EntryWithNames) => string,
  name: (e: EntryWithNames) => string
): Totals[] {
  const map = new Map<string, Totals>();
  for (const e of entries) {
    const k = key(e);
    const t = map.get(k) ?? { name: name(e), hours: 0, open: 0 };
    if (e.end_hours != null) {
      t.hours += e.end_hours - e.start_hours;
    } else {
      t.open += 1;
    }
    map.set(k, t);
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

export default function Dashboard() {
  const [entries, setEntries] = useState<EntryWithNames[] | null>(null);
  const [error, setError] = useState("");
  const week = currentWeekRange();

  useEffect(() => {
    entriesForWeek(week.start, week.end)
      .then(setEntries)
      .catch(() =>
        setError("Can't reach the server — totals need signal to load.")
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byMachine = entries
    ? tally(entries, (e) => e.machine_id, (e) => e.machines?.name ?? "Unknown")
    : [];
  const byCrew = entries
    ? tally(
        entries,
        (e) => e.crew_member_id,
        (e) => e.crew?.name ?? "Unknown"
      )
    : [];

  return (
    <AppShell title="This Week">
      <p className="muted small" style={{ marginTop: -10 }}>
        {formatDate(week.start)} – {formatDate(week.end)}
      </p>
      {error && <p className="notice">{error}</p>}
      {entries && entries.length === 0 && (
        <div className="card">
          <p className="muted">No hours logged this week yet.</p>
          <Link href="/log" className="btn" style={{ textAlign: "center", textDecoration: "none" }}>
            ➕ Log Hours
          </Link>
        </div>
      )}
      {byMachine.length > 0 && (
        <>
          <h2>Hours per machine</h2>
          <div className="card">
            {byMachine.map((t) => (
              <div className="stat-row" key={t.name}>
                <div>
                  <div className="stat-name">{t.name}</div>
                  {t.open > 0 && (
                    <div className="stat-hint">
                      {t.open} open {t.open === 1 ? "entry" : "entries"} not
                      counted
                    </div>
                  )}
                </div>
                <div className="stat-value">
                  {formatHours(t.hours)}
                  <span className="stat-unit">hrs</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {byCrew.length > 0 && (
        <>
          <h2>Hours per crew member</h2>
          <div className="card">
            {byCrew.map((t) => (
              <div className="stat-row" key={t.name}>
                <div>
                  <div className="stat-name">{t.name}</div>
                  {t.open > 0 && (
                    <div className="stat-hint">
                      {t.open} open {t.open === 1 ? "entry" : "entries"} not
                      counted
                    </div>
                  )}
                </div>
                <div className="stat-value">
                  {formatHours(t.hours)}
                  <span className="stat-unit">hrs</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {entries && (
        <WeeklySheets
          entries={entries}
          weekStart={week.start}
          weekEnd={week.end}
        />
      )}
    </AppShell>
  );
}
