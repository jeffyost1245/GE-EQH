// A very small PDF writer: enough to draw a form, and nothing else.
//
// Why not a library: the crews fill these out in dead zones, so the whole
// app has to work from cache, and a PDF generator is a third of a megabyte
// to carry around for one page of lines and text. Everything here uses the
// two fonts every PDF reader already has (Helvetica, Helvetica-Bold), so
// nothing is embedded and a finished sheet lands around 6 KB.
//
// Coordinates are given top-left, in points (72 per inch), and flipped on
// the way out — laying out a form upside down is a good way to make
// mistakes that only show up on the printer.

/** Adobe's standard widths, in 1/1000 em, for the printable ASCII range. */
const HELVETICA: Record<string, number> = widths(
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 " +
    "556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 " +
    "1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 " +
    "667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 " +
    "333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 " +
    "556 556 333 500 278 556 500 722 500 500 500 334 260 334 584"
);

const HELVETICA_BOLD: Record<string, number> = widths(
  "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 " +
    "556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 " +
    "975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 " +
    "667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 " +
    "333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 " +
    "611 611 389 556 333 611 556 778 556 556 500 389 280 389 584"
);

function widths(spec: string): Record<string, number> {
  const table: Record<string, number> = {};
  spec.split(/\s+/).forEach((w, i) => {
    table[String.fromCharCode(32 + i)] = Number(w);
  });
  return table;
}

export interface TextOptions {
  size?: number;
  bold?: boolean;
  /** Bold italic, for the GE mark only — it is a logo, not emphasis. */
  oblique?: boolean;
  /** 0–1 grey, or [r, g, b] each 0–1. Defaults to black. */
  color?: number | [number, number, number];
  align?: "left" | "right" | "center";
  /** Extra space between characters, for the uppercase labels. */
  tracking?: number;
}

export function textWidth(
  str: string,
  size: number,
  bold = false,
  tracking = 0
): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (const ch of str) total += table[ch] ?? 556;
  return (total / 1000) * size + tracking * Math.max(0, str.length - 1);
}

/** Break text to fit a column, on spaces where it can and anywhere it must. */
export function wrapText(
  str: string,
  maxWidth: number,
  size: number,
  bold = false
): string[] {
  const lines: string[] = [];
  for (const paragraph of str.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** PDF strings are parenthesised; three characters have to be escaped. */
function escape(str: string): string {
  return str.replace(/[\\()]/g, "\\$&");
}

/**
 * Drop anything outside the printable ASCII range. The fonts here are
 * WinAnsi and the sheet is typed by hand on a phone, so a stray emoji or
 * smart quote would otherwise come out as mojibake on the printed record.
 */
function ascii(str: string): string {
  return str
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    // The machine label separates its unit number with a middle dot.
    .replace(/\s*[·•]\s*/g, " - ")
    .replace(/[^\x20-\x7e\n]/g, "");
}

function colorOps(color: number | [number, number, number], stroke: boolean) {
  const [r, g, b] = typeof color === "number" ? [color, color, color] : color;
  return `${fixed(r)} ${fixed(g)} ${fixed(b)} ${stroke ? "RG" : "rg"}\n`;
}

function fixed(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

export class Pdf {
  private ops = "";

  constructor(
    readonly width = 612, // US Letter, portrait
    readonly height = 792
  ) {}

  /** Flip a top-left y into PDF's bottom-left space. */
  private y(top: number): number {
    return this.height - top;
  }

  text(x: number, top: number, str: string, options: TextOptions = {}): void {
    const {
      size = 9,
      bold = false,
      oblique = false,
      color = 0,
      align = "left",
      tracking = 0,
    } = options;
    const clean = ascii(str);
    if (!clean) return;

    let left = x;
    if (align !== "left") {
      const w = textWidth(clean, size, bold || oblique, tracking);
      left = align === "right" ? x - w : x - w / 2;
    }

    const font = oblique ? "FI" : bold ? "FB" : "F1";
    // The y given is the text's top edge; PDF places text on its baseline,
    // and Helvetica's cap height is 0.717 em.
    this.ops +=
      colorOps(color, false) +
      `BT /${font} ${fixed(size)} Tf ${fixed(tracking)} Tc ` +
      `${fixed(left)} ${fixed(this.y(top + size * 0.717))} Td ` +
      `(${escape(clean)}) Tj ET\n`;
  }

  line(
    x1: number,
    top1: number,
    x2: number,
    top2: number,
    lineWidth = 0.75,
    color: number | [number, number, number] = 0
  ): void {
    this.ops +=
      colorOps(color, true) +
      `${fixed(lineWidth)} w ${fixed(x1)} ${fixed(this.y(top1))} m ` +
      `${fixed(x2)} ${fixed(this.y(top2))} l S\n`;
  }

  rect(
    x: number,
    top: number,
    w: number,
    h: number,
    options: {
      stroke?: number | [number, number, number] | null;
      fill?: number | [number, number, number] | null;
      lineWidth?: number;
    } = {}
  ): void {
    const { stroke = 0, fill = null, lineWidth = 0.75 } = options;
    if (stroke === null && fill === null) return;
    let ops = "";
    if (fill !== null) ops += colorOps(fill, false);
    if (stroke !== null) ops += colorOps(stroke, true);
    ops += `${fixed(lineWidth)} w ${fixed(x)} ${fixed(this.y(top + h))} ` +
      `${fixed(w)} ${fixed(h)} re `;
    ops += fill !== null && stroke !== null ? "B\n" : fill !== null ? "f\n" : "S\n";
    this.ops += ops;
  }

  /** A single open path — used for the signature's strokes. */
  polyline(
    points: [number, number][],
    lineWidth = 1.1,
    color: number | [number, number, number] = 0
  ): void {
    if (points.length === 0) return;
    if (points.length === 1) {
      // A tap, not a stroke: a zero-length line with round caps is a dot.
      const [x, top] = points[0];
      this.ops +=
        colorOps(color, true) +
        `${fixed(lineWidth)} w 1 J ${fixed(x)} ${fixed(this.y(top))} m ` +
        `${fixed(x)} ${fixed(this.y(top))} l S\n`;
      return;
    }
    let ops = colorOps(color, true) + `${fixed(lineWidth)} w 1 J 1 j `;
    points.forEach(([x, top], i) => {
      ops += `${fixed(x)} ${fixed(this.y(top))} ${i === 0 ? "m" : "l"} `;
    });
    this.ops += ops + "S\n";
  }

  /** Assemble the file. Offsets are counted in bytes, not characters. */
  private serialize(): Uint8Array {
    const stream = this.ops;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] ` +
        "/Resources << /Font << /F1 5 0 R /FB 6 0 R /FI 7 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>",
    ];

    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    let offset = 0;
    const push = (chunk: string) => {
      const bytes = encoder.encode(chunk);
      parts.push(bytes);
      offset += bytes.length;
    };

    push("%PDF-1.4\n");
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(offset);
      push(`${i + 1} 0 obj\n${body}\nendobj\n`);
    });

    const xrefAt = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const at of offsets) {
      xref += `${String(at).padStart(10, "0")} 00000 n \n`;
    }
    push(xref);
    push(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
        `startxref\n${xrefAt}\n%%EOF\n`
    );

    const out = new Uint8Array(offset);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  blob(): Blob {
    // Copy into a fresh buffer so the Blob never sees a SharedArrayBuffer.
    return new Blob([this.serialize().slice().buffer], {
      type: "application/pdf",
    });
  }
}
