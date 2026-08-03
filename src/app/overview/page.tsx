"use client";

// Superintendent home: every crew at a glance for the current week, with
// open repairs surfaced first because that's the thing that needs acting
// on rather than just reading.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import { allEntriesForWeek, allMachines, allRepairs } from "@/lib/data";
import { EntryWithNames, Machine } from "@/lib/types";
import { formatHours, weekLabel, weekRange } from "@/lib/week";

interface CrewSummary {
  crew: string;
  hours: number;
  open: number;
  machines: number;
  repairs: number;
}

export default function OverviewPage() {
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<EntryWithNames[] | null>(null);
  const [machines, setMachines] = useState<
    (Machine & { foremen?: { name: string } | null })[]
  >([]);
  const [repairs, setRepairs] = useState<EntryWithNames[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const week = useMemo(() => weekRange(offset), [offset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      allEntriesForWeek(week.start, week.end),
      allMachines(),
      allRepairs(false),
    ])
      .then(([e, m, r]) => {
        if (cancelled) return;
        setEntries(e);
        setMachines(m);
        setRepairs(r);
      })
      .catch(() => {
        if (!cancelled) setError("Can't reach the server — check your signal.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [week.start, week.end]);

  const summaries = useMemo(() => {
    const map = new Map<string, CrewSummary>();
    const bump = (crew: string): CrewSummary => {
      const s = map.get(crew) ?? {
        crew,
        hours: 0,
        open: 0,
        machines: 0,
        repairs: 0,
      };
      map.set(crew, s);
      return s;
    };
    for (const m of machines) {
      if (m.status === "active") bump(m.foremen?.name ?? "Unknown").machines += 1;
    }
    for (const e of entries ?? []) {
      const s = bump(e.foremen?.name ?? "Unknown");
      if (e.end_hours != null) s.hours += e.end_hours - e.start_hours;
      else s.open += 1;
    }
    for (const r of repairs) bump(r.foremen?.name ?? "Unknown").repairs += 1;
    return [...map.values()].sort((a, b) => a.crew.localeCompare(b.crew));
  }, [entries, machines, repairs]);

  const companyHours = summaries.reduce((n, s) => n + s.hours, 0);

  return (
    <AppShell title={weekLabel(offset, week)}>
      <CrewBar />

      <div className="week-nav">
        <button aria-label="Previous week" onClick={() => setOffset((o) => o - 1)}>
          ‹
        </button>
        <div className="week-nav-label">
          <span>All crews</span>
          {companyHours > 0 && (
            <span className="week-total">{formatHours(companyHours)} hrs</span>
          )}
        </div>
        <button
          aria-label="Next week"
          disabled={offset >= 0}
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
        >
          ›
        </button>
      </div>

      {error && <p className="notice">{error}</p>}
      {loading && !entries && <p className="muted">Loading…</p>}

      {repairs.length > 0 && (
        <Link href="/maintenance" className="repair-callout">
          <span className="repair-count">{repairs.length}</span>
          <span>
            open {repairs.length === 1 ? "repair" : "repairs"} across all crews
            <br />
            <span className="muted small">Tap to review</span>
          </span>
        </Link>
      )}

      {summaries.length > 0 && <h2>By crew</h2>}
      {summaries.map((s) => (
        <div className="machine-day" key={s.crew}>
          <div className="machine-day-top">
            <div>
              <div className="machine-day-name">{s.crew}</div>
              <div className="machine-day-meter">
                {s.machines} {s.machines === 1 ? "machine" : "machines"}
                {s.repairs > 0 && ` · ${s.repairs} open repair`}
                {s.repairs > 1 && "s"}
              </div>
            </div>
            <span className="machine-day-hours">
              {formatHours(s.hours)}
              <span className="stat-unit">hrs</span>
            </span>
          </div>
          {s.open > 0 && (
            <div className="stat-hint">
              {s.open} entry{s.open === 1 ? "" : "s"} still open — not counted
            </div>
          )}
        </div>
      ))}

      {entries && summaries.length === 0 && !loading && (
        <p className="muted">No crews have logged hours this week.</p>
      )}
    </AppShell>
  );
}
