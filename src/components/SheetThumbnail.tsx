"use client";

// A little picture of the filled-out sheet, so a digital one sits in the
// same grid as the photographed ones and reads the same way: you can see
// it's a checkout sheet, and you can see whether anything got marked.
//
// Drawn from the sheet's own marks rather than being decoration — a
// flagged item shows as a filled square in the third column, in roughly
// the place it sits on the paper.

import { SECTIONS, itemKey } from "@/lib/inspection";
import { InspectionItems } from "@/lib/types";

const W = 100;
const H = 129; // 8.5 x 11, near enough
const ROW = 2.45;
const BOX = 1.7;
const GAP = 0.55;

export default function SheetThumbnail({
  items,
  className = "sheet-mini",
  /** Grid cards crop to a fixed height; a full-width one shows it all. */
  fit = "slice",
}: {
  items: InspectionItems;
  className?: string;
  fit?: "slice" | "meet";
}) {
  const columns = [
    [SECTIONS[0], SECTIONS[1]],
    [SECTIONS[2], SECTIONS[3]],
  ];

  const marks: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const headings: React.ReactNode[] = [];

  columns.forEach((sections, column) => {
    const left = 6 + column * 47;
    const width = 41;
    let y = 32;

    for (const section of sections) {
      headings.push(
        <rect
          key={`h-${section.key}`}
          x={left}
          y={y}
          width={14}
          height={1.5}
          fill="#1f2328"
        />
      );
      y += 3.6;

      for (const item of section.items) {
        const answer = items[itemKey(section.key, item.name)];
        const key = `${section.key}-${item.name}`;
        // Ragged label widths read as words; a uniform bar reads as a table.
        const labelWidth = 14 + ((item.name.length * 7) % 11);
        labels.push(
          <rect
            key={`l-${key}`}
            x={left}
            y={y + 0.5}
            width={labelWidth}
            height={0.9}
            rx={0.45}
            fill="#9aa2ac"
          />
        );

        (["na", "ok", "rr"] as const).forEach((column2, i) => {
          const bx = left + width - (3 - i) * (BOX + GAP);
          const on = answer?.mark === column2;
          marks.push(
            <rect
              key={`b-${key}-${column2}`}
              x={bx}
              y={y}
              width={BOX}
              height={BOX}
              rx={0.3}
              fill={on ? "#1f2328" : "#ffffff"}
              stroke={on ? "#1f2328" : "#c2c8d0"}
              strokeWidth={0.28}
            />
          );
        });

        y += ROW;
      }
      y += 2.4;
    }
  });

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Checkout sheet"
      preserveAspectRatio={fit === "slice" ? "xMidYMin slice" : "xMidYMid meet"}
    >
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />

      {/* letterhead */}
      <text x="6" y="10" fontSize="7" fontWeight="800" fontStyle="italic" fill="#d81e3f">
        GE
      </text>
      <rect x="19" y="5.2" width={30} height={1.5} rx={0.5} fill="#1f2328" />
      <rect x="62" y="4.4" width={32} height={2} rx={0.5} fill="#1f2328" />
      <rect x="6" y="12.5" width={88} height={1.4} fill="#d81e3f" />

      {/* header fields */}
      <g stroke="#c2c8d0" strokeWidth="0.35" fill="none">
        <rect x="6" y="16.5" width={88} height={12} />
        <line x1="6" y1="20.5" x2="94" y2="20.5" />
        <line x1="6" y1="24.5" x2="94" y2="24.5" />
        <line x1="47" y1="16.5" x2="47" y2="28.5" />
      </g>

      {headings}
      {labels}
      {marks}

      {/* explanation of defects */}
      <rect x="6" y="106" width={20} height={1.4} fill="#1f2328" />
      <rect
        x="6"
        y="109.5"
        width={88}
        height={9}
        fill="none"
        stroke="#c2c8d0"
        strokeWidth="0.35"
      />

      {/* signature line */}
      <path
        d="M9 124 q3 -3 5 0 t5 0 t4 -1 t6 1"
        fill="none"
        stroke="#1f2328"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <line x1="6" y1="126" x2="44" y2="126" stroke="#1f2328" strokeWidth="0.35" />
      <line x1="52" y1="126" x2="94" y2="126" stroke="#c2c8d0" strokeWidth="0.35" />
    </svg>
  );
}
