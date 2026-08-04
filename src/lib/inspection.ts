// The checkout sheet itself: what it asks, in the order the paper asks it.
//
// This is the one place the item list is written down. The form, the
// read-only record and the PDF all read it from here, so the three can
// never drift apart — and when the paper form changes, this is the only
// edit.

import { InspectionItems, Mark } from "./types";

export interface SheetItem {
  name: string;
  /** Small print carried over from the paper, e.g. "check only when COLD". */
  hint?: string;
}

export interface SheetSection {
  key: string;
  title: string;
  items: SheetItem[];
}

export const SECTIONS: SheetSection[] = [
  {
    key: "outside",
    title: "Outside",
    items: [
      { name: "Lights" },
      { name: "Steps/Hand Rails" },
      { name: "Tires/Tracks" },
      { name: "Exhaust" },
      { name: "Fenders" },
      { name: "Bucket" },
      { name: "Cutting Edge/Teeth" },
      { name: "Lifting Mechanism" },
      { name: "Hoses" },
      { name: "Fittings Greased" },
      { name: "Hitch/Coupler" },
      { name: "Wipers" },
    ],
  },
  {
    key: "engine",
    title: "Engine Compartment",
    items: [
      { name: "Battery Cable" },
      { name: "Fan Belt" },
      { name: "Hoses" },
      { name: "Air Filter" },
      { name: "Guards" },
    ],
  },
  {
    key: "cab",
    title: "Inside Cab",
    items: [
      { name: "Brakes, Service" },
      { name: "Brakes, Parking" },
      { name: "Backup Alarm" },
      { name: "Fire Extinguisher" },
      { name: "Gauges" },
      { name: "Horn" },
      { name: "Hydraulic Controls" },
      { name: "Glass (all sides)" },
      { name: "Mirror" },
      { name: "Roll Over Protection" },
      { name: "Seat Belt/Seat" },
      { name: "Steering" },
    ],
  },
  {
    key: "fluids",
    title: "Fluids",
    items: [
      { name: "Visible Leaks" },
      { name: "Oil Level/Pressure" },
      { name: "Coolant Level", hint: "check only when COLD" },
      { name: "Hydraulic Oil Level" },
      { name: "Transmission Fluid Level" },
      { name: "Fuel Level" },
    ],
  },
];

/** Storage key for one item. Section included: "Hoses" appears twice. */
export function itemKey(sectionKey: string, itemName: string): string {
  return `${sectionKey}/${itemName}`;
}

export const TOTAL_ITEMS = SECTIONS.reduce((n, s) => n + s.items.length, 0);

export function countAnswered(items: InspectionItems): number {
  let n = 0;
  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (items[itemKey(section.key, item.name)]) n++;
    }
  }
  return n;
}

export interface Flagged {
  section: string;
  item: string;
  note: string;
}

/** Every item marked RR, in sheet order, with what the operator said. */
export function flaggedItems(items: InspectionItems): Flagged[] {
  const out: Flagged[] = [];
  for (const section of SECTIONS) {
    for (const item of section.items) {
      const answer = items[itemKey(section.key, item.name)];
      if (answer?.mark === "rr") {
        out.push({
          section: section.title,
          item: item.name,
          note: answer.note?.trim() ?? "",
        });
      }
    }
  }
  return out;
}

export function countMark(items: InspectionItems, mark: Mark): number {
  let n = 0;
  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (items[itemKey(section.key, item.name)]?.mark === mark) n++;
    }
  }
  return n;
}

/**
 * The defect paragraph, built from the flagged items. Written into the
 * sheet's own field so the record keeps the wording it was signed with,
 * even if the item list is edited later.
 */
export function defectSummary(items: InspectionItems): string {
  return flaggedItems(items)
    .map((f) => `${f.section} — ${f.item}: ${f.note || "see operator"}`)
    .join("\n");
}

/**
 * Short label for a card's badge. Capped: a sheet with six flags would
 * otherwise stretch the card taller than the picture above it, and the
 * count carries the same message as the list.
 */
export function flagBadgeText(items: InspectionItems): string {
  const flagged = flaggedItems(items);
  if (flagged.length === 0) return "All clear";
  if (flagged.length <= 2) return flagged.map((f) => f.item).join(", ");
  return `${flagged[0].item} +${flagged.length - 1} more`;
}

/** One line for the maintenance list and the entry note. */
export function flaggedSummaryLine(items: InspectionItems): string {
  const flagged = flaggedItems(items);
  if (flagged.length === 0) return "";
  if (flagged.length === 1) {
    const [f] = flagged;
    return f.note ? `${f.item}: ${f.note}` : f.item;
  }
  return flagged.map((f) => f.item).join(", ");
}
