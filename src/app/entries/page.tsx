"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { listEntries } from "@/lib/data";
import { machineLabel } from "@/lib/machineTypes";
import { formatDate, formatHours } from "@/lib/week";
import { EntryWithNames } from "@/lib/types";

export default function EntriesPage() {
  const [entries, setEntries] = useState<EntryWithNames[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listEntries()
      .then(setEntries)
      .catch(() => setError("Can't load entries — no signal."));
  }, []);

  // group by date, newest first (already sorted by the query)
  const groups: { date: string; items: EntryWithNames[] }[] = [];
  for (const e of entries ?? []) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  return (
    <AppShell title="Entries">
      {error && <p className="notice">{error}</p>}
      {entries && entries.length === 0 && (
        <p className="muted">No entries yet.</p>
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
