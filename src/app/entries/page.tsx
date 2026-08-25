"use client";

// Every entry the crew logged, one week at a time.
//
// It used to be the last hundred entries in one scroll, which meant
// finding Tuesday's meant thumbing past the rest of the month. The week
// is how the dashboard already thinks, and how a foreman thinks — so
// this page cycles the same Monday-to-Sunday weeks, with the same arrows.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { entriesForWeek } from "@/lib/data";
import { machineLabel } from "@/lib/machineTypes";
import {
  formatDate,
  formatDayHeading,
  formatHours,
  weekRange,
} from "@/lib/week";
import { EntryWithNames } from "@/lib/types";

export default function EntriesPage() {
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<EntryWithNames[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const week = useMemo(() => weekRange(offset), [offset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    entriesForWeek(week.start, week.end)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Can't load entries — no signal.");
          setEntries(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [week.start, week.end]);

  // Newest day first, and within a day the entry logged most recently —
  // the one a foreman is most likely to be coming here to fix.
  const groups = useMemo(() => {
    const sorted = [...(entries ?? [])].sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.created_at.localeCompare(a.created_at)
    );
    const out: { date: string; items: EntryWithNames[] }[] = [];
    for (const e of sorted) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else out.push({ date: e.date, items: [e] });
    }
    return out;
  }, [entries]);

  const weekTotal = useMemo(
    () =>
      (entries ?? []).reduce(
        (sum, e) =>
          sum + (e.end_hours != null ? e.end_hours - e.start_hours : 0),
        0
      ),
    [entries]
  );

  return (
    <AppShell title="Entries">
      <div className="week-nav">
        <button
          aria-label="Previous week"
          onClick={() => setOffset((o) => o - 1)}
        >
          ‹
        </button>
        <div className="week-nav-label">
          <span>
            {formatDayHeading(week.start).split(" · ")[1]} –{" "}
            {formatDayHeading(week.end).split(" · ")[1]}
          </span>
          {weekTotal > 0 && (
            <span className="week-total">{formatHours(weekTotal)} hrs</span>
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

      {offset !== 0 && (
        <button
          className="btn btn-small btn-secondary"
          style={{ marginBottom: 12 }}
          onClick={() => setOffset(0)}
        >
          Back to this week
        </button>
      )}

      {error && <p className="notice">{error}</p>}
      {loading && !entries && <p className="muted">Loading…</p>}

      {entries && entries.length === 0 && !loading && (
        <div className="card">
          <p className="muted">
            {offset === 0
              ? "No hours logged this week yet."
              : "No hours logged that week."}
          </p>
          {offset === 0 && (
            <Link
              href="/log"
              className="btn"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              ➕ Log Hours
            </Link>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.date}>
          <h2>{formatDate(g.date)}</h2>
          {g.items.map((e) => (
            <Link
              href={`/entries/edit?id=${e.id}`}
              key={e.id}
              className="entry-item"
            >
              <div className="entry-top">
                <span>{e.machines ? machineLabel(e.machines) : "Unknown machine"}</span>
                <span className="entry-hours">
                  {formatHours(e.start_hours)} →{" "}
                  {e.end_hours != null ? (
                    formatHours(e.end_hours)
                  ) : (
                    <span className="badge badge-open">open</span>
                  )}
                </span>
              </div>
              <div className="entry-sub">
                {e.crew?.name ?? "Unknown"}
                {e.job_tag ? ` · ${e.job_tag}` : ""}
                {e.end_hours != null &&
                  ` · ${formatHours(e.end_hours - e.start_hours)} hrs`}
                {e.end_hours_autofilled && (
                  <>
                    {" "}
                    <span className="badge badge-auto">end auto-filled</span>
                  </>
                )}
              </div>
              {e.note && <div className="entry-sub">{e.note}</div>}
            </Link>
          ))}
        </section>
      ))}
    </AppShell>
  );
}
