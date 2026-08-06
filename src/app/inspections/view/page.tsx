"use client";

// One finished sheet, as a record. Read-only on purpose: it is the thing
// the safety officer files, and the PDF button hands it to whatever the
// phone already uses — Drive, Files, Gmail, the printer.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import SheetPdfButton from "@/components/SheetPdfButton";
import SheetPaper from "@/components/SheetPaper";
import { deleteInspection, getInspection } from "@/lib/data";
import { machineLabel } from "@/lib/machineTypes";
import { flaggedItems } from "@/lib/inspection";
import { currentCrew } from "@/lib/tenant";
import { InspectionWithNames } from "@/lib/types";
import { formatDate, todayString } from "@/lib/week";

function Record() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [sheet, setSheet] = useState<InspectionWithNames | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function removeSheet() {
    if (!sheet) return;
    const name = sheet.machines?.name ?? "this machine";
    if (
      !window.confirm(
        `Delete the checkout sheet for ${name}? This can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteInspection(sheet.id);
      router.push("/inspections");
    } catch {
      setDeleteError("Couldn't delete it — check your signal and try again.");
      setDeleting(false);
    }
  }

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
          <span>{sheet.machines ? machineLabel(sheet.machines) : "Machine"}</span>
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

        <SheetPaper
          sheet={sheet}
          context={{
            machineName: sheet.machines ? machineLabel(sheet.machines) : "Machine",
            operatorName: sheet.crew?.name ?? "",
            crewName: sheet.foremen?.name ?? currentCrew()?.name ?? "",
          }}
        />
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
        <button
          type="button"
          className="btn btn-small btn-danger"
          style={{ marginTop: 10 }}
          disabled={deleting}
          onClick={() => void removeSheet()}
        >
          {deleting ? "Deleting…" : "Delete this sheet"}
        </button>
        {deleteError && <p className="error">{deleteError}</p>}
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

      {/* No item-by-item summary below: the sheet above already says all
          of it, and two versions of the same answers invite the question
          of which one is right. */}
      {!editable && (
        <p className="small muted">
          Locked — the day it covers has passed.
        </p>
      )}
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
