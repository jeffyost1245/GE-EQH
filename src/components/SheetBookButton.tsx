"use client";

// Every sheet on the screen, bound into one PDF.
//
// The safety officer files these. Before this, filing a week meant
// opening the link, saving nine files, and combining them by hand —
// so the file this makes is the whole week, in date order, with an
// index page in front of it.

import { useState } from "react";
import { buildInspectionBook, bookFilename } from "@/lib/inspectionPdf";
import { machineLabel } from "@/lib/machineTypes";
import { currentCrew } from "@/lib/tenant";
import { InspectionWithNames } from "@/lib/types";

export default function SheetBookButton({
  sheets,
  weekStart,
  weekEnd,
  className = "btn btn-secondary",
}: {
  sheets: InspectionWithNames[];
  /** Names the file. Falls back to the range the sheets themselves cover. */
  weekStart?: string;
  weekEnd?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function send() {
    setBusy(true);
    setNote("");

    // Date order, oldest first, then by machine: a record reads
    // forward, and two sheets from the same day should sit together.
    const ordered = [...sheets].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.machines?.unit_no ?? a.machines?.name ?? "").localeCompare(
        b.machines?.unit_no ?? b.machines?.name ?? ""
      );
    });

    const start = weekStart ?? ordered[0]?.date ?? "";
    const end = weekEnd ?? ordered[ordered.length - 1]?.date ?? start;
    const name = bookFilename(start, end);

    try {
      const blob = buildInspectionBook(
        ordered.map((sheet) => ({
          inspection: sheet,
          context: {
            machineName: sheet.machines
              ? machineLabel(sheet.machines)
              : "Machine",
            operatorName: sheet.crew?.name ?? "",
            crewName: sheet.foremen?.name ?? currentCrew()?.name ?? "",
          },
        })),
        start ? { start, end } : undefined
      );
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
        setNote("Couldn't build the combined PDF on this device.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (sheets.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={() => void send()}
      >
        {busy ? "Building…" : `📕 Save all ${sheets.length} as one PDF`}
      </button>
      {note && <p className="small muted">{note}</p>}
    </>
  );
}
