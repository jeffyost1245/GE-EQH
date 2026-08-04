"use client";

// The crew's checkout sheets, newest first and grouped by day, laid out
// the same way the dashboard shows them: a picture of the sheet you tap
// to open.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import SheetThumbnail from "@/components/SheetThumbnail";
import { listInspections } from "@/lib/data";
import { flagBadgeText, flaggedItems } from "@/lib/inspection";
import { InspectionWithNames } from "@/lib/types";
import { formatDate, todayString } from "@/lib/week";

export default function InspectionsPage() {
  const [sheets, setSheets] = useState<InspectionWithNames[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setSheets(await listInspections());
      } catch {
        setError("Can't reach the server — sheets need signal to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, InspectionWithNames[]>();
    for (const sheet of sheets) {
      map.set(sheet.date, [...(map.get(sheet.date) ?? []), sheet]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [sheets]);

  const today = todayString();

  return (
    <AppShell title="Checkout Sheets">
      <Link className="btn" href="/inspect">
        + New checkout sheet
      </Link>

      {error && <p className="notice">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && !error && sheets.length === 0 && (
        <p className="muted">
          No sheets yet. Fill one out when you check a machine out in the
          morning.
        </p>
      )}

      {byDay.map(([date, items]) => (
        <div key={date} className="sheet-day">
          <h3>{date === today ? "Today" : formatDate(date)}</h3>
          <div className="sheet-grid">
            {items.map((sheet) => {
              const flagged = flaggedItems(sheet.items ?? {});
              return (
                <Link
                  key={sheet.id}
                  className="sheet-thumb"
                  href={`/inspections/view?id=${sheet.id}`}
                >
                  <SheetThumbnail items={sheet.items ?? {}} />
                  <span className="sheet-caption">
                    {sheet.machines?.name ?? "Machine"}
                    <br />
                    <span className="muted">{sheet.crew?.name ?? ""}</span>
                    <span
                      className={`badge ${
                        flagged.length > 0 ? "badge-repair" : "badge-clean"
                      }`}
                    >
                      {flagBadgeText(sheet.items ?? {})}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </AppShell>
  );
}
