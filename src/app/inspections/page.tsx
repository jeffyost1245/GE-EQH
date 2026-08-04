"use client";

// The crew's checkout sheets, newest first. Flagged machines carry a
// badge so a foreman can see what came back broken without opening
// anything.

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { listInspections } from "@/lib/data";
import { countMark, flaggedSummaryLine } from "@/lib/inspection";
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

      {sheets.map((sheet) => {
        const summary = flaggedSummaryLine(sheet.items);
        return (
          <Link
            key={sheet.id}
            className="card entry-item"
            href={`/inspections/view?id=${sheet.id}`}
          >
            <div className="entry-top">
              <span>{sheet.machines?.name ?? "Machine"}</span>
              <span className="muted small">
                {sheet.date === today ? "Today" : formatDate(sheet.date)}
              </span>
            </div>
            <div className="entry-sub">
              {sheet.crew?.name ?? "—"}
              {sheet.hour_meter != null && ` · ${sheet.hour_meter} hrs`}
              {countMark(sheet.items, "na") > 0 &&
                ` · ${countMark(sheet.items, "na")} N/A`}
            </div>
            {sheet.repairs_needed ? (
              <div className="badge badge-repair">
                {summary || "Needs repair"}
              </div>
            ) : (
              <div className="badge badge-clean">All clear</div>
            )}
          </Link>
        );
      })}
    </AppShell>
  );
}
