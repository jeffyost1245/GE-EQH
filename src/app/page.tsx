"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import WeeklySheets from "@/components/WeeklySheets";
import { entriesForWeek, inspectionsForWeek } from "@/lib/data";
import { flaggedItems } from "@/lib/inspection";
import { machineLabel } from "@/lib/machineTypes";
import {
  formatDayHeading,
  formatHours,
  weekLabel,
  weekRange,
} from "@/lib/week";
import { EntryWithNames, InspectionWithNames } from "@/lib/types";

/** One person's stint on a machine that day. */
interface Stint {
  id: string;
  who: string;
  hours: number | null; // null while the entry is still open
  job: string;
}

/** All work on one machine on one day, folded together. */
interface MachineDay {
  machineId: string;
  machine: string;
  hours: number;
  open: number;
  /** Hour meter at the first start and the last finish of the day. */
  meterStart: number | null;
  meterEnd: number | null;
  /** The day's checkout sheet for this machine, if one was filled in. */
  sheetId: string | null;
  sheetFlagged: boolean;
  stints: Stint[];
}

/** Keyed by machine and day, which is how a sheet is filed. */
function sheetIndex(
  sheets: InspectionWithNames[]
): Map<string, { id: string; flagged: boolean }> {
  const index = new Map<string, { id: string; flagged: boolean }>();
  for (const sheet of sheets) {
    index.set(`${sheet.machine_id}|${sheet.date}`, {
      id: sheet.id,
      flagged: flaggedItems(sheet.items ?? {}).length > 0,
    });
  }
  return index;
}

function groupByDayAndMachine(
  entries: EntryWithNames[],
  sheets: Map<string, { id: string; flagged: boolean }>
): [string, MachineDay[]][] {
  const days = new Map<string, Map<string, MachineDay>>();

  for (const e of entries) {
    const byMachine = days.get(e.date) ?? new Map<string, MachineDay>();
    const group: MachineDay = byMachine.get(e.machine_id) ?? {
      machineId: e.machine_id,
      machine: e.machines ? machineLabel(e.machines) : "Unknown machine",
      hours: 0,
      open: 0,
      meterStart: null,
      meterEnd: null,
      sheetId: sheets.get(`${e.machine_id}|${e.date}`)?.id ?? null,
      sheetFlagged: sheets.get(`${e.machine_id}|${e.date}`)?.flagged ?? false,
      stints: [],
    };

    const worked = e.end_hours != null ? e.end_hours - e.start_hours : null;
    if (worked != null) group.hours += worked;
    else group.open += 1;

    // Lowest start and highest finish across the day, so handing a machine
    // between operators still reads as one continuous run.
    group.meterStart =
      group.meterStart == null
        ? e.start_hours
        : Math.min(group.meterStart, e.start_hours);
    if (e.end_hours != null) {
      group.meterEnd =
        group.meterEnd == null
          ? e.end_hours
          : Math.max(group.meterEnd, e.end_hours);
    }

    group.stints.push({
      id: e.id,
      who: e.crew?.name ?? "Unknown",
      hours: worked,
      job: e.job_tag ?? "",
    });

    byMachine.set(e.machine_id, group);
    days.set(e.date, byMachine);
  }

  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0])) // Monday first
    .map(([date, byMachine]) => [
      date,
      [...byMachine.values()].sort((a, b) => a.machine.localeCompare(b.machine)),
    ]);
}

export default function Dashboard() {
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<EntryWithNames[] | null>(null);
  const [sheets, setSheets] = useState<InspectionWithNames[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const week = useMemo(() => weekRange(offset), [offset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    // The sheets are a side question: if they fail the hours still show.
    inspectionsForWeek(week.start, week.end)
      .then((rows) => {
        if (!cancelled) setSheets(rows);
      })
      .catch(() => undefined);

    entriesForWeek(week.start, week.end)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Can't reach the server — totals need signal to load.");
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

  const days = useMemo(
    () => (entries ? groupByDayAndMachine(entries, sheetIndex(sheets)) : []),
    [entries, sheets]
  );

  const weekTotal = useMemo(
    () =>
      days.reduce(
        (sum, [, machines]) =>
          sum + machines.reduce((s, m) => s + m.hours, 0),
        0
      ),
    [days]
  );

  return (
    <AppShell title={weekLabel(offset, week)}>
      <CrewBar />

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

      {days.map(([date, machines]) => (
        <section key={date}>
          <h2>{formatDayHeading(date)}</h2>
          {machines.map((m) => (
            <div className="machine-day" key={m.machineId}>
              <div className="machine-day-top">
                <div>
                  <div className="machine-day-name">
                    {m.machine}
                    {m.sheetId ? (
                      <Link
                        className={`sheet-tick${m.sheetFlagged ? " flagged" : ""}`}
                        href={`/inspections/view?id=${m.sheetId}`}
                      >
                        {m.sheetFlagged ? "✓ sheet · repair" : "✓ sheet"}
                      </Link>
                    ) : (
                      <span className="sheet-tick missing">no sheet</span>
                    )}
                  </div>
                  {m.meterStart != null && (
                    <div className="machine-day-meter">
                      {formatHours(m.meterStart)} →{" "}
                      {m.meterEnd != null ? formatHours(m.meterEnd) : "—"}
                    </div>
                  )}
                </div>
                <span className="machine-day-hours">
                  {formatHours(m.hours)}
                  <span className="stat-unit">hrs</span>
                </span>
              </div>
              {m.stints.map((s) => (
                <div className="stint" key={s.id}>
                  <span className="stint-who">{s.who}</span>
                  <span className="stint-hours">
                    {s.hours != null ? (
                      formatHours(s.hours)
                    ) : (
                      <span className="badge badge-open">open</span>
                    )}
                  </span>
                  <span className="stint-job">{s.job}</span>
                </div>
              ))}
              {m.open > 0 && (
                <div className="stat-hint">
                  {m.open} still open — not counted in the total
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

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
