"use client";

// One finished sheet, as a record. Read-only on purpose: it is the thing
// the safety officer files, and the PDF button hands it to whatever the
// phone already uses — Drive, Files, Gmail, the printer.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import SheetPdfButton from "@/components/SheetPdfButton";
import { getInspection } from "@/lib/data";
import { SECTIONS, flaggedItems, itemKey } from "@/lib/inspection";
import { InspectionWithNames } from "@/lib/types";
import { formatDate, todayString } from "@/lib/week";

function Record() {
  const id = useSearchParams().get("id") ?? "";
  const [sheet, setSheet] = useState<InspectionWithNames | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!id) {
        setError("No sheet asked for.");
        return;
      }
      try {
        const found = await getInspection(id);
        if (!found) setError("That sheet isn't here — it may belong to another crew.");
        else setSheet(found);
      } catch {
        setError("Can't reach the server, so this sheet can't be loaded.");
      }
    })();
  }, [id]);

  if (error) {
    return (
      <>
        <p className="notice">{error}</p>
        <Link className="btn btn-secondary" href="/inspections">
          Back to sheets
        </Link>
      </>
    );
  }

  if (!sheet) return <p className="muted">Loading sheet…</p>;

  const flagged = flaggedItems(sheet.items);
  const editable = sheet.date === todayString();

  return (
    <>
      <div className="card">
        <div className="entry-top">
          <span>{sheet.machines?.name ?? "Machine"}</span>
          <span className="muted small">{formatDate(sheet.date)}</span>
        </div>
        <div className="entry-sub">
          {sheet.crew?.name ?? "—"}
          {sheet.shift ? ` · ${sheet.shift} shift` : ""}
          {sheet.hour_meter != null ? ` · ${sheet.hour_meter} hrs` : ""}
        </div>
        {(sheet.location || sheet.job_name || sheet.job_no) && (
          <div className="entry-sub">
            {[sheet.location, sheet.job_no && `Job ${sheet.job_no}`, sheet.job_name]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        <SheetPdfButton sheet={sheet} className="btn" />
        {editable && (
          <Link
            className="btn btn-small btn-secondary"
            style={{ marginTop: 10 }}
            href={`/inspect?machine=${sheet.machine_id}&date=${sheet.date}`}
          >
            Fix something on this sheet
          </Link>
        )}
      </div>

      {flagged.length > 0 && (
        <>
          <h2>Needs repair</h2>
          <div className="card">
            {flagged.map((f) => (
              <div key={`${f.section}/${f.item}`} className="insp-flag">
                <span className="insp-flag-item">{f.item}</span>
                <span className="muted small"> · {f.section}</span>
                {f.note && <p className="insp-flag-note">{f.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {SECTIONS.map((section) => {
        const marks = section.items.map((item) => ({
          item,
          answer: sheet.items[itemKey(section.key, item.name)],
        }));
        const notable = marks.filter((m) => m.answer?.mark !== "ok");
        const okCount = marks.length - notable.length;
        return (
          <div key={section.key}>
            <h2>{section.title}</h2>
            <div className="card">
              <p className="small muted" style={{ margin: 0 }}>
                {okCount === marks.length
                  ? `All ${marks.length} OK`
                  : `${okCount} of ${marks.length} OK`}
              </p>
              {notable.map(({ item, answer }) => (
                <div key={item.name} className="insp-row insp-recorded">
                  <span className="insp-name">{item.name}</span>
                  <span className={`tag tag-${answer?.mark ?? "none"}`}>
                    {answer?.mark === "rr"
                      ? "RR"
                      : answer?.mark === "na"
                        ? "N/A"
                        : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="small muted">
        {sheet.repairs_needed
          ? "Operator: repairs or adjustments needed."
          : "Operator: repairs or adjustments NOT needed for safe equipment operation."}
        {sheet.signed_at &&
          ` Signed ${new Date(sheet.signed_at).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}.`}
        {!editable && " Locked — the day it covers has passed."}
      </p>
    </>
  );
}

export default function InspectionViewPage() {
  return (
    <AppShell title="Checkout Sheet">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <Record />
      </Suspense>
    </AppShell>
  );
}
