"use client";

// The finished sheet, on screen, laid out exactly as it prints.
//
// The thumbnail elsewhere is a drawing — grey bars standing in for
// words — which is right at the size of a postage stamp and useless at
// the size of a page. This is the real thing: the values that were
// typed, the boxes that were ticked, the signature that was drawn.
//
// Sized in points to match src/lib/inspectionPdf.ts, then scaled down to
// whatever width the phone gives us. Anything changed here has to change
// there too, or the sheet on screen stops matching the one that prints.

import { useCallback, useEffect, useRef, useState } from "react";
import { SECTIONS, flaggedItems, itemKey } from "@/lib/inspection";
import { InspectionWithNames, Mark, Signature } from "@/lib/types";

const PAGE_W = 612;
const PAGE_H = 792;

export interface PaperContext {
  machineName: string;
  operatorName: string;
  crewName: string;
  companyName?: string;
}

export default function SheetPaper({
  sheet,
  context,
}: {
  sheet: InspectionWithNames;
  context: PaperContext;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [full, setFull] = useState(false);

  const fit = useCallback(() => {
    const width = holderRef.current?.clientWidth ?? 0;
    if (width) setScale(Math.min(1, width / PAGE_W));
  }, []);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  const company = context.companyName ?? "General Excavating";
  const flagged = flaggedItems(sheet.items ?? {});
  const written = (sheet.defects ?? "").trim();

  const page = (
    <div className="paper" style={{ width: PAGE_W, minHeight: PAGE_H }}>
      <div className="paper-head">
        <div className="paper-logo">
          <b>GE</b>
          <span>{company}</span>
        </div>
        <div className="paper-title">
          Equipment Safety Inspection
          <small>Operator&apos;s daily checkout — retain per company policy</small>
        </div>
      </div>
      <div className="paper-rule" />

      <div className="paper-fields">
        <Field label="Company" value={company} span={2} />
        <Field label="Location" value={sheet.location ?? ""} span={2} />
        <Field label="Date" value={usDate(sheet.date)} />
        <Field label="Shift" value={sheet.shift ?? ""} />

        <Field label="Job #" value={sheet.job_no ?? ""} />
        <Field label="Job Name" value={sheet.job_name ?? ""} span={2} />
        <Field label="Equipment" value={context.machineName} span={2} />
        <Field label="Crew" value={context.crewName} />

        <Field label="Operator" value={context.operatorName} span={3} />
        <Field
          label="Hour Meter"
          value={sheet.hour_meter == null ? "" : String(sheet.hour_meter)}
        />
        <Field label="Mileage" value={sheet.mileage || "—"} />
        <Field label="Submitted" value={clockTime(sheet.signed_at)} />
      </div>

      <div className="paper-cols">
        <div>
          <Section sheet={sheet} index={0} />
          <Section sheet={sheet} index={1} />
        </div>
        <div>
          <Section sheet={sheet} index={2} />
          <Section sheet={sheet} index={3} />
        </div>
      </div>

      <div className="paper-block">Explanation of Defects (RR)</div>
      <div className="paper-defects">
        {written ? (
          // What was signed, verbatim. It already carries the flagged
          // items and anything else the operator typed, so rebuilding it
          // from the marks here would drop the free text — which is
          // exactly what used to happen.
          written.split("\n").map((line, i) => <p key={i}>{line}</p>)
        ) : flagged.length > 0 ? (
          flagged.map((f) => (
            <p key={`${f.section}/${f.item}`}>
              {f.section} — {f.item}: {f.note || "see operator"}
            </p>
          ))
        ) : (
          <span className="paper-none">None reported.</span>
        )}
      </div>

      <div className="paper-verdict">
        <span>
          <Box on={sheet.repairs_needed} /> Repairs or adjustments{" "}
          <b>needed</b>
        </span>
        <span>
          <Box on={!sheet.repairs_needed} /> Repairs or adjustments{" "}
          <b>NOT needed</b> for safe equipment operation
        </span>
      </div>

      <div className="paper-sigs">
        <div>
          <SignatureMark signature={sheet.signature} />
          <div className="paper-sigline">
            <span>Operator&apos;s signature</span>
            <span>{usDate(sheet.date)}</span>
          </div>
        </div>
        <div>
          <div className="paper-sigspace" />
          <div className="paper-sigline">
            <span>Repairs completed / reviewed by</span>
            <span>Date ____________</span>
          </div>
        </div>
      </div>

      <div className="paper-foot">
        <span>{company} — Lincoln, Nebraska</span>
        <span>Record {sheet.id.slice(0, 8)}</span>
      </div>
    </div>
  );

  return (
    <>
      <div className="paper-holder" ref={holderRef}>
        <div
          className="paper-scaler"
          style={{
            transform: `scale(${scale})`,
            height: PAGE_H * scale,
          }}
        >
          {page}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-small btn-secondary paper-zoom"
        onClick={() => setFull(true)}
      >
        🔍 Read it full size
      </button>

      {full && (
        <div className="paper-overlay" role="dialog" aria-label="Checkout sheet">
          <div className="paper-overlay-bar">
            <span>{context.machineName}</span>
            <button
              type="button"
              className="linkish"
              onClick={() => setFull(false)}
            >
              Close
            </button>
          </div>
          <div className="paper-overlay-scroll">{page}</div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  span = 1,
}: {
  label: string;
  value: string;
  span?: number;
}) {
  return (
    <div className="paper-field" style={{ gridColumn: `span ${span}` }}>
      <label>{label}</label>
      <b>{value}</b>
    </div>
  );
}

function Section({
  sheet,
  index,
}: {
  sheet: InspectionWithNames;
  index: number;
}) {
  const section = SECTIONS[index];
  return (
    <div className="paper-section">
      <div className="paper-block">{section.title}</div>
      <div className="paper-legend">
        <span>N/A</span>
        <span>OK</span>
        <span>RR</span>
      </div>
      {section.items.map((item) => {
        const answer = sheet.items?.[itemKey(section.key, item.name)];
        return (
          <div
            className={`paper-item${answer?.mark === "rr" ? " flagged" : ""}`}
            key={item.name}
          >
            <span className="paper-item-name">
              {item.name}
              {item.hint && <em> — {item.hint}</em>}
            </span>
            <span className="paper-boxes">
              {(["na", "ok", "rr"] as Mark[]).map((column) => (
                <Box
                  key={column}
                  on={answer?.mark === column}
                  solid={column === "rr" && answer?.mark === "rr"}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A ticked box. RR fills solid so it still carries on a photocopy. */
function Box({ on, solid = false }: { on: boolean; solid?: boolean }) {
  return (
    <span className={`paper-box${on ? " on" : ""}${solid ? " solid" : ""}`}>
      {on ? "✕" : ""}
    </span>
  );
}

function SignatureMark({ signature }: { signature: Signature | null }) {
  if (!signature?.strokes?.length) return <div className="paper-sigspace" />;
  return (
    <svg
      className="paper-sig"
      viewBox={`0 0 ${signature.w} ${signature.h}`}
      preserveAspectRatio="xMinYMax meet"
      aria-label="Operator's signature"
    >
      {signature.strokes.map((stroke, i) => (
        <polyline
          key={i}
          points={stroke.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#000"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

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
