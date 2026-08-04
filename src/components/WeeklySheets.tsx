"use client";

// This week's checkout sheets, grouped by day, with a link the safety
// officer can open without the crew password.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createShareLink, inspectionsForWeek } from "@/lib/data";
import { flaggedItems } from "@/lib/inspection";
import { sheetPhotoUrls } from "@/lib/photo";
import { EntryWithNames, InspectionWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

export default function WeeklySheets({
  entries,
  weekStart,
  weekEnd,
}: {
  entries: EntryWithNames[];
  weekStart: string;
  weekEnd: string;
}) {
  const withPhotos = useMemo(
    () => entries.filter((e) => e.photo_path),
    [entries]
  );
  const [filled, setFilled] = useState<InspectionWithNames[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const paths = withPhotos.map((e) => e.photo_path!).filter(Boolean);
    if (paths.length === 0) return;
    sheetPhotoUrls(paths).then(setUrls);
  }, [withPhotos]);

  useEffect(() => {
    inspectionsForWeek(weekStart, weekEnd)
      .then(setFilled)
      // Offline, or the migration hasn't run yet: the photos below still
      // show, which is the behaviour this screen had before.
      .catch(() => setFilled([]));
  }, [weekStart, weekEnd]);

  const byDay = useMemo(() => {
    const map = new Map<string, EntryWithNames[]>();
    for (const e of withPhotos) {
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [withPhotos]);

  async function share() {
    setSharing(true);
    setShareError("");
    try {
      const link = await createShareLink(weekStart, weekEnd);
      const url = `${window.location.origin}/share?t=${link.id}`;
      setShareUrl(url);
      // Offer the phone's own share sheet when it has one (text, email…).
      if (navigator.share) {
        await navigator
          .share({
            title: "Equipment checkout sheets",
            text: `Checkout sheets for the week of ${formatDate(weekStart)}`,
            url,
          })
          .catch(() => {});
      }
    } catch {
      setShareError("Couldn't create the link — check your signal.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <details className="sheets">
      <summary>
        📋 Checkout sheets this week
        <span className="sheets-count">{withPhotos.length + filled.length}</span>
      </summary>

      <div className="card">
        {withPhotos.length === 0 && filled.length === 0 && (
          <p className="muted small" style={{ margin: 0 }}>
            No checkout sheets this week yet. Fill one out when you check a
            machine out, or photograph the paper one.
          </p>
        )}

        {filled.map((sheet) => {
          const flagged = flaggedItems(sheet.items);
          return (
            <Link
              key={sheet.id}
              className="sheet-line"
              href={`/inspections/view?id=${sheet.id}`}
            >
              <span className="sheet-line-machine">
                {sheet.machines?.name ?? "Machine"}
              </span>
              <span className="muted small">{formatDate(sheet.date)}</span>
              <span
                className={`badge ${
                  flagged.length > 0 ? "badge-repair" : "badge-clean"
                }`}
              >
                {flagged.length > 0
                  ? flagged.map((f) => f.item).join(", ")
                  : "All clear"}
              </span>
            </Link>
          );
        })}

        {byDay.map(([date, items]) => (
          <div key={date} className="sheet-day">
            <h3>{formatDate(date)}</h3>
            <div className="sheet-grid">
              {items.map((e) => {
                const url = e.photo_path ? urls[e.photo_path] : undefined;
                return (
                  <a
                    key={e.id}
                    href={url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="sheet-thumb"
                    onClick={(ev) => {
                      if (!url) ev.preventDefault();
                    }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`Sheet for ${e.machines?.name}`} />
                    ) : (
                      <span className="sheet-loading">…</span>
                    )}
                    <span className="sheet-caption">
                      {e.machines?.name ?? "Unknown"}
                      <br />
                      <span className="muted">{e.crew?.name ?? ""}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}

        {withPhotos.length + filled.length > 0 && (
          <>
            <button
              className="btn btn-secondary"
              disabled={sharing}
              onClick={() => void share()}
            >
              {sharing ? "Creating link…" : "📤 Send week to safety"}
            </button>
            {shareUrl && (
              <div className="notice notice-ok">
                <p style={{ margin: "0 0 8px" }}>
                  Link ready — works without the crew password, good for 30
                  days.
                </p>
                <input type="text" readOnly value={shareUrl} />
                <button
                  className="btn btn-small btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(shareUrl);
                    setCopied(true);
                  }}
                >
                  {copied ? "✓ Copied" : "Copy link"}
                </button>
              </div>
            )}
            {shareError && <p className="error">{shareError}</p>}
          </>
        )}
      </div>
    </details>
  );
}
