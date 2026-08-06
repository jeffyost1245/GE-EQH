// Working out what every machine in the company is doing, from what the
// crews already log.
//
// Nothing here asks anyone to keep a board up to date. Hours say whether
// a machine has been used; checkout sheets say where it was and whether
// it needs work. A dispatch board that depends on someone remembering to
// update it goes stale and starts lying, which is worse than not having
// one.

import { Entry, Inspection, Machine } from "./types";
import { isAttachment } from "./machineTypes";

/** A machine sitting this many working days is called out as free. */
export const IDLE_THRESHOLD = 5;

export type FleetStatus =
  | "down" // something is flagged for repair — never dispatch this
  | "available" // idle past the threshold, nothing flagged
  | "working" // used recently
  | "unused" // no hours ever logged
  | "stock"; // an attachment: no meter, so no such thing as idle

export interface FleetRow {
  machine: Machine & { foremen?: { name: string } | null };
  crew: string;
  status: FleetStatus;
  /** Working days since it last turned a wheel; null if it never has. */
  idleDays: number | null;
  lastWorked: string | null;
  /** Where it last worked, best available. */
  job: string;
  flagged: boolean;
}

type ActivityRow = Pick<
  Entry,
  "machine_id" | "date" | "job_tag" | "needs_repair" | "repair_done"
>;

type SheetRow = Pick<
  Inspection,
  | "machine_id"
  | "date"
  | "job_no"
  | "job_name"
  | "location"
  | "repairs_needed"
  | "repair_done"
>;

/**
 * Days worked between two dates, counting Saturdays and skipping
 * Sundays. A machine parked on Friday afternoon should not read as
 * idle-for-three by Monday morning just because a weekend went past.
 */
export function workdaysSince(from: string, to: string): number {
  const start = parseDate(from);
  const end = parseDate(to);
  let days = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end) {
    if (cursor.getDay() !== 0) days++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function buildFleet(
  machines: (Machine & { foremen?: { name: string } | null })[],
  activity: ActivityRow[],
  sheets: SheetRow[],
  today: string
): FleetRow[] {
  // Both lists arrive newest first, so the first hit for a machine is
  // its most recent.
  const lastEntry = new Map<string, ActivityRow>();
  const openRepair = new Set<string>();
  for (const row of activity) {
    if (!lastEntry.has(row.machine_id)) lastEntry.set(row.machine_id, row);
    if (row.needs_repair && !row.repair_done) openRepair.add(row.machine_id);
  }

  const lastSheet = new Map<string, SheetRow>();
  for (const row of sheets) {
    if (!lastSheet.has(row.machine_id)) lastSheet.set(row.machine_id, row);
    if (row.repairs_needed && !row.repair_done) openRepair.add(row.machine_id);
  }

  return machines.map((machine) => {
    const entry = lastEntry.get(machine.id);
    const sheet = lastSheet.get(machine.id);
    const flagged = openRepair.has(machine.id);
    const lastWorked = entry?.date ?? null;
    const idleDays = lastWorked ? workdaysSince(lastWorked, today) : null;

    return {
      machine,
      crew: machine.foremen?.name ?? "—",
      status: statusFor(machine, flagged, idleDays),
      idleDays,
      lastWorked,
      job: jobFor(sheet, entry),
      flagged,
    };
  });
}

function statusFor(
  machine: Machine,
  flagged: boolean,
  idleDays: number | null
): FleetStatus {
  // Attachments have no hour meter, so none of the idle reasoning
  // applies to them. They are carried to say what is on site.
  if (isAttachment(machine.machine_type ?? null)) return "stock";
  // A flagged machine is never available, however long it has sat —
  // sending a truck for a deadlined machine is worse than not knowing.
  if (flagged) return "down";
  if (idleDays === null) return "unused";
  return idleDays >= IDLE_THRESHOLD ? "available" : "working";
}

/**
 * Where it last was. The checkout sheet is preferred because it carries
 * the job number, which two crews spelling a site differently still
 * agree on; the entry's free-text job is the fallback.
 */
function jobFor(sheet: SheetRow | undefined, entry: ActivityRow | undefined): string {
  if (sheet) {
    const parts = [
      sheet.job_no ? `Job ${sheet.job_no}` : "",
      sheet.job_name || sheet.location || "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }
  return entry?.job_tag?.trim() || "";
}

export const STATUS_LABEL: Record<FleetStatus, string> = {
  down: "DOWN",
  available: "AVAILABLE",
  working: "IN USE",
  unused: "NO HOURS",
  stock: "ON SITE",
};
