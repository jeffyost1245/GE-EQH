"use client";

// Hand a finished sheet to the phone as a real PDF file. On a phone the
// share sheet takes it straight to Drive, Files, Gmail or the printer; on
// a desktop browser, which has no share sheet, it downloads instead.

import { useState } from "react";
import { buildInspectionPdf, inspectionFilename } from "@/lib/inspectionPdf";
import { currentCrew } from "@/lib/tenant";
import { InspectionWithNames } from "@/lib/types";

export default function SheetPdfButton({
  sheet,
  className = "btn btn-small btn-secondary",
}: {
  sheet: InspectionWithNames;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function send() {
    setBusy(true);
    setNote("");
    const name = inspectionFilename(
      sheet.machines?.name ?? "machine",
      sheet.date
    );
    try {
      const blob = buildInspectionPdf(sheet, {
        machineName: sheet.machines?.name ?? "Machine",
        operatorName: sheet.crew?.name ?? "",
        crewName: sheet.foremen?.name ?? currentCrew()?.name ?? "",
      });
      const file = new File([blob], name, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
        setNote(`Saved ${name}.`);
      }
    } catch (cause) {
      // Backing out of the share sheet is a choice, not a failure.
      if ((cause as Error)?.name !== "AbortError") {
        setNote("Couldn't build the PDF on this phone.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        style={{ marginTop: 10 }}
        onClick={() => void send()}
      >
        {busy ? "Building…" : "📄 Send PDF"}
      </button>
      {note && <p className="small muted">{note}</p>}
    </>
  );
}
