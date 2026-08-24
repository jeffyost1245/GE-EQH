// The checkout sheet, laid out for paper.
//
// One US Letter page, drawn to match the form the crews already know:
// same header fields, same items in the same order, same three columns.
// Every item prints, answered or not — a form with gaps in it looks
// unfinished in a file six months from now.
//
// The same drawing runs twice over: one sheet on its own, and a whole
// week bound into a single file with an index in front of it. The safety
// officer files these, and filing a week means one upload, not nine.

import { Pdf, textWidth, wrapText } from "./pdf";
import { SECTIONS, flaggedItems, itemKey } from "./inspection";
import { InspectionWithNames, Mark, Signature } from "./types";

const GE_RED: [number, number, number] = [0.847, 0.118, 0.247]; // #d81e3f
const GREY = 0.27;
const HAIRLINE = 0.72;

const PAGE_W = 612;
const MARGIN = 32;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BOX = 13; // an item's N/A / OK / RR square
const BOX_GAP = 9;
const BOXES_W = BOX * 3 + BOX_GAP * 2;
const ROW_H = 13.6;

/** Index rows per page, and the columns they sit in. Widths sum to 548. */
const INDEX_ROWS = 34;
const INDEX_ROW_H = 15.5;
const INDEX_COLUMNS: { label: string; width: number; align?: "right" }[] = [
  { label: "Date", width: 58 },
  { label: "Equipment", width: 140 },
  { label: "Operator", width: 80 },
  { label: "Crew", width: 72 },
  { label: "Hours", width: 44, align: "right" },
  { label: "Result", width: 126 },
  { label: "Page", width: 28, align: "right" },
];
/** Right-aligned columns stop short of the next one, or they touch it. */
const INDEX_GUTTER = 8;

export interface SheetContext {
  machineName: string;
  operatorName: string;
  crewName: string;
  companyName?: string;
  /** Set only inside a bound file, to print "Page 3 of 10". */
  page?: { number: number; total: number };
}

export function inspectionFilename(
  machineName: string,
  date: string
): string {
  const machine = machineName
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${machine || "machine"}_${date}.pdf`;
}

/** What a bound file is called: the range it covers, not a machine. */
export function bookFilename(weekStart: string, weekEnd?: string): string {
  return weekEnd && weekEnd !== weekStart
    ? `checkout-sheets_${weekStart}_to_${weekEnd}.pdf`
    : `checkout-sheets_${weekStart}.pdf`;
}

export function buildInspectionPdf(
  inspection: InspectionWithNames,
  context: SheetContext
): Blob {
  const pdf = new Pdf();
  drawInspection(pdf, inspection, context);
  return pdf.blob();
}

/** One sheet and the names that go on it, ready to be bound. */
export interface BoundSheet {
  inspection: InspectionWithNames;
  context: SheetContext;
}

/**
 * A week of sheets as one file: an index page, then every sheet drawn
 * exactly as it prints on its own. Sheets come out in the order given —
 * the caller decides, because the screen's order is the one the reader
 * is already looking at.
 */
export function buildInspectionBook(
  sheets: BoundSheet[],
  range?: { start: string; end: string; companyName?: string }
): Blob {
  const pdf = new Pdf();
  if (sheets.length === 0) return pdf.blob();

  const company =
    range?.companyName ?? sheets[0].context.companyName ?? "General Excavating";
  const indexPages = Math.ceil(sheets.length / INDEX_ROWS);
  const total = indexPages + sheets.length;

  drawIndex(pdf, sheets, { company, range, indexPages, total });

  sheets.forEach((sheet, i) => {
    pdf.newPage();
    drawInspection(pdf, sheet.inspection, {
      ...sheet.context,
      companyName: sheet.context.companyName ?? company,
      page: { number: indexPages + i + 1, total },
    });
  });

  return pdf.blob();
}

function drawInspection(
  pdf: Pdf,
  inspection: InspectionWithNames,
  context: SheetContext
): void {
  const company = context.companyName ?? "General Excavating";
  let y = MARGIN;

  // ---------- letterhead ----------

  pdf.text(MARGIN, y + 2, "GE", { size: 21, oblique: true, color: GE_RED });
  pdf.text(MARGIN + textWidth("GE", 21, true) + 6, y + 8, company.toUpperCase(), {
    size: 10,
    bold: true,
    tracking: 1.2,
  });

  pdf.text(PAGE_W - MARGIN, y, "EQUIPMENT SAFETY INSPECTION", {
    size: 12,
    bold: true,
    align: "right",
    tracking: 0.4,
  });
  pdf.text(
    PAGE_W - MARGIN,
    y + 15,
    "Operator's daily checkout - retain per company policy",
    { size: 7.5, align: "right", color: GREY }
  );

  y += 30;
  pdf.rect(MARGIN, y, CONTENT_W, 3, { stroke: null, fill: GE_RED });
  y += 10;

  // ---------- header fields ----------

  const unit = CONTENT_W / 6;
  const rowH = 30;

  const rows: { label: string; value: string; span: number }[][] = [
    [
      { label: "Company", value: company, span: 2 },
      { label: "Location", value: inspection.location ?? "", span: 2 },
      { label: "Date", value: usDate(inspection.date), span: 1 },
      { label: "Shift", value: inspection.shift ?? "", span: 1 },
    ],
    [
      { label: "Job #", value: inspection.job_no ?? "", span: 1 },
      { label: "Job Name", value: inspection.job_name ?? "", span: 2 },
      { label: "Equipment", value: context.machineName, span: 2 },
      { label: "Crew", value: context.crewName, span: 1 },
    ],
    [
      { label: "Operator", value: context.operatorName, span: 3 },
      {
        label: "Hour Meter",
        value: inspection.hour_meter == null ? "" : String(inspection.hour_meter),
        span: 1,
      },
      { label: "Mileage", value: inspection.mileage || "-", span: 1 },
      { label: "Submitted", value: clockTime(inspection.signed_at), span: 1 },
    ],
  ];

  const gridTop = y;
  for (const row of rows) {
    let x = MARGIN;
    for (const cell of row) {
      const w = unit * cell.span;
      pdf.rect(x, y, w, rowH, { stroke: 0, lineWidth: HAIRLINE });
      pdf.text(x + 4, y + 3, cell.label.toUpperCase(), {
        size: 6.5,
        bold: true,
        color: GREY,
        tracking: 0.5,
      });
      pdf.text(x + 4, y + 12.5, clip(cell.value, w - 8, 10.5), {
        size: 10.5,
        bold: true,
      });
      x += w;
    }
    y += rowH;
  }
  // Redraw the outline so the shared cell borders don't look doubled.
  pdf.rect(MARGIN, gridTop, CONTENT_W, rowH * rows.length, {
    stroke: 0,
    lineWidth: 1.1,
  });

  y += 12;

  // ---------- inspection items, two columns ----------

  const colGap = 14;
  const colW = (CONTENT_W - colGap) / 2;
  const columns = [
    [SECTIONS[0], SECTIONS[1]], // Outside, Engine Compartment
    [SECTIONS[2], SECTIONS[3]], // Inside Cab, Fluids
  ];

  let deepest = y;
  columns.forEach((sections, index) => {
    const x = MARGIN + index * (colW + colGap);
    let cy = y;
    for (const section of sections) {
      cy = drawSection(pdf, inspection, section, x, cy, colW);
      cy += 9;
    }
    deepest = Math.max(deepest, cy);
  });

  y = deepest + 2;

  // ---------- explanation of defects ----------

  y = blockTitle(pdf, "Explanation of Defects (RR)", MARGIN, y, CONTENT_W);

  const flagged = flaggedItems(inspection.items);
  const bodySize = 9.5;
  const lineH = 12.5;
  const inset = 7;
  const written = (inspection.defects ?? "").trim();

  const defectLines: { text: string; faint: boolean }[] = [];
  const columnW = CONTENT_W - inset * 2;

  if (written) {
    // The sheet's own defect text, printed as signed. It already
    // contains the flagged items plus anything else the operator wrote,
    // so listing the flagged items again would print them twice and
    // still risk dropping the free text.
    for (const text of wrapText(written, columnW, bodySize)) {
      defectLines.push({ text, faint: false });
    }
  } else {
    // Sheets saved before the text was stored: rebuild from the marks.
    for (const f of flagged) {
      const paragraph = `${f.section} - ${f.item}: ${f.note || "see operator"}`;
      for (const text of wrapText(paragraph, columnW, bodySize)) {
        defectLines.push({ text, faint: false });
      }
    }
  }

  if (defectLines.length === 0) {
    defectLines.push({ text: "None reported.", faint: true });
  }

  const boxH = Math.max(52, defectLines.length * lineH + 10);
  pdf.rect(MARGIN, y, CONTENT_W, boxH, { stroke: 0, lineWidth: HAIRLINE });
  defectLines.forEach((line, i) => {
    pdf.text(MARGIN + inset, y + 6 + i * lineH, line.text, {
      size: bodySize,
      color: line.faint ? GREY : 0,
    });
  });
  y += boxH + 10;

  // ---------- operator's verdict ----------

  const needed = inspection.repairs_needed;
  checkbox(pdf, MARGIN, y, needed);
  pdf.text(MARGIN + BOX + 6, y + 2, "Repairs or adjustments needed", {
    size: 9,
  });

  const secondX = MARGIN + 230;
  checkbox(pdf, secondX, y, !needed);
  pdf.text(
    secondX + BOX + 6,
    y + 2,
    "Repairs or adjustments NOT needed for safe equipment operation",
    { size: 9 }
  );
  y += 30;

  // ---------- signatures ----------

  const sigW = (CONTENT_W - 24) / 2;
  const sigH = 34;

  if (inspection.signature) {
    drawSignature(pdf, inspection.signature, MARGIN + 2, y, sigW - 60, sigH);
  }
  y += sigH;

  signatureLine(
    pdf,
    MARGIN,
    y,
    sigW,
    "Operator's signature",
    usDate(inspection.date)
  );
  signatureLine(
    pdf,
    MARGIN + sigW + 24,
    y,
    sigW,
    "Repairs completed / reviewed by",
    "Date ______________"
  );

  // ---------- footer ----------

  const footY = 792 - MARGIN - 10;
  pdf.line(MARGIN, footY - 5, PAGE_W - MARGIN, footY - 5, 0.5, 0.6);
  pdf.text(MARGIN, footY, `${company} - Lincoln, Nebraska`, {
    size: 6.5,
    color: 0.35,
  });
  if (context.page) {
    pdf.text(
      PAGE_W / 2,
      footY,
      `Page ${context.page.number} of ${context.page.total}`,
      { size: 6.5, color: 0.35, align: "center" }
    );
  }
  pdf.text(
    PAGE_W - MARGIN,
    footY,
    `Record ${inspection.id.slice(0, 8)} - generated ${stamp(inspection.signed_at)}` +
      (inspection.corrected_at
        ? ` - corrected ${stamp(inspection.corrected_at)}`
        : ""),
    { size: 6.5, color: 0.35, align: "right" }
  );
}

// ---------- the index ----------

/**
 * What's in the file, in the order it's bound. A stack of nine sheets
 * with no front page is a stack; this makes it a record — you can see at
 * a glance which machines ran that week and which ones came back with
 * something wrong, without paging through.
 */
function drawIndex(
  pdf: Pdf,
  sheets: BoundSheet[],
  meta: {
    company: string;
    range?: { start: string; end: string };
    indexPages: number;
    total: number;
  }
): void {
  const flaggedCount = sheets.filter(
    (s) => flaggedItems(s.inspection.items).length > 0
  ).length;

  for (let page = 0; page < meta.indexPages; page++) {
    if (page > 0) pdf.newPage();
    let y = MARGIN;

    // ---------- letterhead, matching the sheets behind it ----------

    pdf.text(MARGIN, y + 2, "GE", { size: 21, oblique: true, color: GE_RED });
    pdf.text(
      MARGIN + textWidth("GE", 21, true) + 6,
      y + 8,
      meta.company.toUpperCase(),
      { size: 10, bold: true, tracking: 1.2 }
    );
    pdf.text(PAGE_W - MARGIN, y, "EQUIPMENT SAFETY INSPECTIONS", {
      size: 12,
      bold: true,
      align: "right",
      tracking: 0.4,
    });
    pdf.text(
      PAGE_W - MARGIN,
      y + 15,
      meta.range
        ? `Week of ${usDate(meta.range.start)} - ${usDate(meta.range.end)}`
        : "Operators' daily checkouts",
      { size: 7.5, align: "right", color: GREY }
    );

    y += 30;
    pdf.rect(MARGIN, y, CONTENT_W, 3, { stroke: null, fill: GE_RED });
    y += 14;

    // ---------- what the file holds ----------

    const count = `${sheets.length} ${sheets.length === 1 ? "sheet" : "sheets"}`;
    const repairs =
      flaggedCount === 0
        ? "none with repairs requested"
        : `${flaggedCount} with repairs requested`;
    pdf.text(MARGIN, y, `${count} - ${repairs}`, { size: 10.5, bold: true });
    pdf.text(
      PAGE_W - MARGIN,
      y + 1.5,
      `Compiled ${stamp(new Date().toISOString())}`,
      { size: 7.5, color: GREY, align: "right" }
    );
    y += 24;

    // ---------- column headings ----------

    let x = MARGIN;
    for (const column of INDEX_COLUMNS) {
      pdf.text(
        column.align === "right" ? x + column.width - INDEX_GUTTER : x,
        y,
        column.label.toUpperCase(),
        {
          size: 6.5,
          bold: true,
          color: GREY,
          tracking: 0.5,
          align: column.align ?? "left",
        }
      );
      x += column.width;
    }
    y += 11;
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y, 1.25);
    y += 5;

    // ---------- one row per sheet ----------

    const from = page * INDEX_ROWS;
    for (const [i, bound] of sheets.slice(from, from + INDEX_ROWS).entries()) {
      const { inspection, context } = bound;
      const flagged = flaggedItems(inspection.items);
      const values = [
        usDate(inspection.date),
        context.machineName,
        context.operatorName || "-",
        context.crewName || "-",
        inspection.hour_meter == null ? "-" : String(inspection.hour_meter),
        flagged.length > 0
          ? `RR: ${flagged.map((f) => f.item).join(", ")}`
          : "OK",
        String(meta.indexPages + from + i + 1),
      ];

      let cx = MARGIN;
      values.forEach((value, column) => {
        const { width, align } = INDEX_COLUMNS[column];
        // The result column is the one a safety officer scans for, so it
        // carries the same red as the sheet's own flags.
        const isResult = column === 5;
        const bold = isResult && flagged.length > 0;
        pdf.text(
          align === "right" ? cx + width - INDEX_GUTTER : cx,
          y,
          clip(value, width - INDEX_GUTTER, 8.5),
          {
            size: 8.5,
            bold,
            color: bold ? GE_RED : 0,
            align: align ?? "left",
          }
        );
        cx += width;
      });

      y += INDEX_ROW_H;
      pdf.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4, 0.4, 0.78);
    }

    // ---------- footer ----------

    const footY = 792 - MARGIN - 10;
    pdf.line(MARGIN, footY - 5, PAGE_W - MARGIN, footY - 5, 0.5, 0.6);
    pdf.text(MARGIN, footY, `${meta.company} - Lincoln, Nebraska`, {
      size: 6.5,
      color: 0.35,
    });
    pdf.text(PAGE_W / 2, footY, `Page ${page + 1} of ${meta.total}`, {
      size: 6.5,
      color: 0.35,
      align: "center",
    });
    pdf.text(PAGE_W - MARGIN, footY, "Contents", {
      size: 6.5,
      color: 0.35,
      align: "right",
    });
  }
}

// ---------- pieces ----------

function drawSection(
  pdf: Pdf,
  inspection: InspectionWithNames,
  section: (typeof SECTIONS)[number],
  x: number,
  top: number,
  width: number
): number {
  let y = blockTitle(pdf, section.title, x, top, width);

  // Column captions, centred over the squares they label.
  const boxesLeft = x + width - BOXES_W;
  ["N/A", "OK", "RR"].forEach((label, i) => {
    pdf.text(boxesLeft + i * (BOX + BOX_GAP) + BOX / 2, y, label, {
      size: 6.5,
      bold: true,
      color: GREY,
      align: "center",
      tracking: 0.3,
    });
  });
  y += 10;

  for (const item of section.items) {
    const answer = inspection.items[itemKey(section.key, item.name)];
    const mark = answer?.mark;
    const flagged = mark === "rr";

    const labelSize = 9;
    let labelWidth = textWidth(item.name, labelSize, flagged);
    pdf.text(x, y + 2.5, item.name, { size: labelSize, bold: flagged });
    if (item.hint) {
      const hint = ` - ${item.hint}`;
      const room = width - BOXES_W - 8 - labelWidth;
      if (textWidth(hint, 7) <= room) {
        pdf.text(x + labelWidth, y + 4, hint, { size: 7, color: GREY });
        labelWidth += textWidth(hint, 7);
      }
    }

    (["na", "ok", "rr"] as Mark[]).forEach((column, i) => {
      checkbox(
        pdf,
        boxesLeft + i * (BOX + BOX_GAP),
        y,
        mark === column,
        column === "rr" && mark === "rr"
      );
    });

    y += ROW_H;
    pdf.line(x, y - 2, x + width, y - 2, 0.4, 0.72);
  }

  return y;
}

/** An uppercase heading with the form's heavy rule under it. */
function blockTitle(
  pdf: Pdf,
  title: string,
  x: number,
  top: number,
  width: number
): number {
  pdf.text(x, top, title.toUpperCase(), {
    size: 8.5,
    bold: true,
    tracking: 0.8,
  });
  pdf.line(x, top + 12, x + width, top + 12, 1.25);
  return top + 16;
}

/** A square, optionally marked. RR fills solid so it carries on a copier. */
function checkbox(
  pdf: Pdf,
  x: number,
  top: number,
  on: boolean,
  solid = false
): void {
  pdf.rect(x, top, BOX, BOX, {
    stroke: 0,
    fill: on && solid ? 0 : null,
    lineWidth: HAIRLINE,
  });
  if (!on) return;

  // An X drawn as two strokes: a glyph would sit differently in every
  // reader, and this lands square in the box every time.
  const pad = 3.1;
  const ink = solid ? 1 : 0;
  pdf.line(x + pad, top + pad, x + BOX - pad, top + BOX - pad, 1.3, ink);
  pdf.line(x + BOX - pad, top + pad, x + pad, top + BOX - pad, 1.3, ink);
}

function signatureLine(
  pdf: Pdf,
  x: number,
  top: number,
  width: number,
  label: string,
  right: string
): void {
  pdf.line(x, top, x + width, top, HAIRLINE);
  pdf.text(x, top + 3, label.toUpperCase(), {
    size: 7,
    bold: true,
    color: GREY,
    tracking: 0.5,
  });
  pdf.text(x + width, top + 3, right, { size: 7.5, bold: true, color: GREY, align: "right" });
}

/** Redraw the finger-drawn strokes as vectors, fitted to the space. */
function drawSignature(
  pdf: Pdf,
  signature: Signature,
  x: number,
  top: number,
  maxW: number,
  maxH: number
): void {
  if (!signature.w || !signature.h) return;
  const scale = Math.min(maxW / signature.w, maxH / signature.h);
  for (const stroke of signature.strokes) {
    pdf.polyline(
      stroke.map(
        ([px, py]) => [x + px * scale, top + py * scale] as [number, number]
      ),
      1.15
    );
  }
}

// ---------- formatting ----------

function usDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${m}/${d}/${y}`;
}

function clockTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function stamp(iso: string | null): string {
  if (!iso) return "-";
  const at = new Date(iso);
  return `${at.toLocaleDateString()} ${clockTime(iso)}`;
}

/** Trim a value that would otherwise run out of its cell. */
function clip(value: string, maxWidth: number, size: number): string {
  if (textWidth(value, size, true) <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && textWidth(`${out}...`, size, true) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}
