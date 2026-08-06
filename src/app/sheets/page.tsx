"use client";

// Checkout sheets from every crew, newest first, so the superintendent
// can find a machine's inspection without knowing whose crew had it.

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import SheetPdfButton from "@/components/SheetPdfButton";
import SheetPaper from "@/components/SheetPaper";
import { allInspections, allSheets } from "@/lib/data";
import { machineLabel } from "@/lib/machineTypes";
import { flaggedItems } from "@/lib/inspection";
import { sheetPhotoUrls } from "@/lib/photo";
import { EntryWithNames, InspectionWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

export default function SheetsPage() {
  const [sheets, setSheets] = useState<EntryWithNames[] | null>(null);
  const [digital, setDigital] = useState<InspectionWithNames[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [crew, setCrew] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      allSheets(),
      // Fail soft: until the inspections migration is applied there is no
      // such table, and that must not take the photographed sheets down
      // with it.
      allInspections().catch(() => [] as InspectionWithNames[]),
    ])
      .then(async ([photos, filled]) => {
        setSheets(photos);
        setDigital(filled);
        setUrls(await sheetPhotoUrls(photos.map((r) => r.photo_path!)));
      })
      .catch(() => setError("Can't reach the server — check your signal."));
  }, []);

  const crews = useMemo(() => {
    const names = new Set<string>();
    for (const s of sheets ?? []) names.add(s.foremen?.name ?? "Unknown");
    for (const s of digital) names.add(s.foremen?.name ?? "Unknown");
    return [...names].sort();
  }, [sheets, digital]);

  const matches = (name: string | undefined) =>
    crew === "all" || (name ?? "Unknown") === crew;

  const visible = (sheets ?? []).filter((s) => matches(s.foremen?.name));
  const visibleDigital = digital.filter((s) => matches(s.foremen?.name));

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

      {sheets && visible.length === 0 && visibleDigital.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          No checkout sheets yet.
        </p>
      )}

      {visibleDigital.length > 0 && <h2>Filled out in the app</h2>}
      {visibleDigital.map((s) => {
        const flagged = flaggedItems(s.items);
        return (
          <div className="card" key={s.id}>
            <div className="entry-top">
              <span>{s.machines ? machineLabel(s.machines) : "Unknown machine"}</span>
              <span className="muted small">{formatDate(s.date)}</span>
            </div>
            <div className="entry-sub">
              {s.foremen?.name ?? "Unknown crew"} · {s.crew?.name ?? "Unknown"}
              {s.hour_meter != null && ` · ${s.hour_meter} hrs`}
            </div>
            {flagged.length > 0 ? (
              <div className="badge badge-repair">
                {flagged.map((f) => f.item).join(", ")}
              </div>
            ) : (
              <div className="badge badge-clean">All clear</div>
            )}
            <SheetPaper
              sheet={s}
              context={{
                machineName: s.machines ? machineLabel(s.machines) : "Machine",
                operatorName: s.crew?.name ?? "",
                crewName: s.foremen?.name ?? "",
              }}
            />
            <SheetPdfButton sheet={s} />
          </div>
        );
      })}

      {visible.length > 0 && visibleDigital.length > 0 && <h2>Photographed</h2>}

      {visible.map((s) => {
        const url = s.photo_path ? urls[s.photo_path] : undefined;
        return (
          <div className="card" key={s.id} style={{ marginTop: 12 }}>
            <div className="entry-top">
              <span>{s.machines ? machineLabel(s.machines) : "Unknown machine"}</span>
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
