"use client";

// Checkout sheets from every crew, newest first, so the superintendent
// can find a machine's inspection without knowing whose crew had it.

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import { allSheets } from "@/lib/data";
import { sheetPhotoUrls } from "@/lib/photo";
import { EntryWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

export default function SheetsPage() {
  const [sheets, setSheets] = useState<EntryWithNames[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [crew, setCrew] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    allSheets()
      .then(async (rows) => {
        setSheets(rows);
        setUrls(await sheetPhotoUrls(rows.map((r) => r.photo_path!)));
      })
      .catch(() => setError("Can't reach the server — check your signal."));
  }, []);

  const crews = useMemo(() => {
    const names = new Set<string>();
    for (const s of sheets ?? []) names.add(s.foremen?.name ?? "Unknown");
    return [...names].sort();
  }, [sheets]);

  const visible = (sheets ?? []).filter(
    (s) => crew === "all" || (s.foremen?.name ?? "Unknown") === crew
  );

  return (
    <AppShell title="Checkout Sheets">
      <CrewBar />
      {error && <p className="notice">{error}</p>}

      {crews.length > 1 && (
        <>
          <label htmlFor="crewfilter">Crew</label>
          <select
            id="crewfilter"
            value={crew}
            onChange={(e) => setCrew(e.target.value)}
          >
            <option value="all">All crews</option>
            {crews.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </>
      )}

      {sheets && visible.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          No checkout sheets photographed yet.
        </p>
      )}

      {visible.map((s) => {
        const url = s.photo_path ? urls[s.photo_path] : undefined;
        return (
          <div className="card" key={s.id} style={{ marginTop: 12 }}>
            <div className="entry-top">
              <span>{s.machines?.name ?? "Unknown machine"}</span>
              <span className="muted small">{formatDate(s.date)}</span>
            </div>
            <div className="entry-sub">
              {s.foremen?.name ?? "Unknown crew"} · {s.crew?.name ?? "Unknown"}
              {s.needs_repair && !s.repair_done && (
                <>
                  {" "}
                  <span className="badge badge-open">needs repair</span>
                </>
              )}
            </div>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Checkout sheet for ${s.machines?.name}`}
                  className="sheet-full"
                />
              </a>
            ) : (
              <p className="muted small">Loading photo…</p>
            )}
          </div>
        );
      })}
    </AppShell>
  );
}
