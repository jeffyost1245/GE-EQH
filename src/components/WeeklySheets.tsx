"use client";

// This week's checkout sheets, grouped by day, with a link the safety
// officer can open without the crew password.
//
// Filled-out sheets and photographed ones sit in the same grid on
// purpose: to a foreman they are the same thing — the sheet for that
// machine that day — and which way it was captured is not what he's
// scanning for.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createShareLink,
  deleteInspection,
  inspectionsForWeek,
  removeEntryPhoto,
} from "@/lib/data";
import { flagBadgeText, flaggedItems } from "@/lib/inspection";
import { machineLabel } from "@/lib/machineTypes";
import { sheetPhotoUrls } from "@/lib/photo";
import SheetThumbnail from "./SheetThumbnail";
import { EntryWithNames, InspectionItems, InspectionWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

type Card =
  | {
      kind: "photo";
      id: string;
      date: string;
      machine: string;
      who: string;
      path: string;
    }
  | {
      kind: "sheet";
      id: string;
      date: string;
      machine: string;
      who: string;
      items: InspectionItems;
      needsRepair: boolean;
      label: string;
    };

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

  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState("");
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    const paths = withPhotos.map((e) => e.photo_path!).filter(Boolean);
    if (paths.length === 0) return;
    sheetPhotoUrls(paths).then(setUrls);
  }, [withPhotos]);

  useEffect(() => {
    inspectionsForWeek(weekStart, weekEnd)
      // Offline, or the migration hasn't run yet: the photos still show,
      // which is the behaviour this screen had before.
      .catch(() => [] as InspectionWithNames[])
      .then(setFilled);
  }, [weekStart, weekEnd]);

  const byDay = useMemo(() => {
    const cards: Card[] = [
      ...filled.map(
        (s): Card => ({
          kind: "sheet",
          id: s.id,
          date: s.date,
          machine: s.machines ? machineLabel(s.machines) : "Machine",
          who: s.crew?.name ?? "",
          items: s.items ?? {},
          needsRepair: flaggedItems(s.items ?? {}).length > 0,
          label: flagBadgeText(s.items ?? {}),
        })
      ),
      ...withPhotos.map(
        (e): Card => ({
          kind: "photo",
          id: e.id,
          date: e.date,
          machine: e.machines ? machineLabel(e.machines) : "Unknown",
          who: e.crew?.name ?? "",
          path: e.photo_path!,
        })
      ),
    ];

    const map = new Map<string, Card[]>();
    for (const card of cards) {
      if (removed.has(`${card.kind}-${card.id}`)) continue;
      map.set(card.date, [...(map.get(card.date) ?? []), card]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filled, withPhotos, removed]);

  const total = byDay.reduce((n, [, cards]) => n + cards.length, 0);

  async function remove(card: Card) {
    const label =
      card.kind === "sheet"
        ? `Delete the checkout sheet for ${card.machine}? This can't be undone.`
        : `Remove the sheet photo for ${card.machine}? The hours logged that day stay.`;
    if (!window.confirm(label)) return;

    const key = `${card.kind}-${card.id}`;
    setBusyId(key);
    setRemoveError("");
    try {
      if (card.kind === "sheet") await deleteInspection(card.id);
      else await removeEntryPhoto(card.id);
      setRemoved((prev) => new Set(prev).add(key));
    } catch {
      setRemoveError("Couldn't remove it — check your signal and try again.");
    } finally {
      setBusyId("");
    }
  }

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
        <span className="sheets-count">{total}</span>
      </summary>

      <div className="card">
        {total === 0 && (
          <p className="muted small" style={{ margin: 0 }}>
            No checkout sheets this week yet. Fill one out when you check a
            machine out, or photograph the paper one.
          </p>
        )}

        {total > 0 && (
          <div className="sheets-tools">
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setRemoving((on) => !on);
                setRemoveError("");
              }}
            >
              {removing ? "Done" : "Remove sheets"}
            </button>
          </div>
        )}
        {removeError && <p className="error">{removeError}</p>}

        {byDay.map(([date, cards]) => (
          <div key={date} className="sheet-day">
            <h3>{formatDate(date)}</h3>
            <div className="sheet-grid">
              {cards.map((card) => {
                const key = `${card.kind}-${card.id}`;
                const caption = (
                  <span className="sheet-caption">
                    {card.machine}
                    <br />
                    <span className="muted">{card.who}</span>
                    {card.kind === "sheet" && (
                      <span
                        className={`badge ${
                          card.needsRepair ? "badge-repair" : "badge-clean"
                        }`}
                      >
                        {card.label}
                      </span>
                    )}
                  </span>
                );

                // In remove mode the card stops being a way in: a thumb
                // aiming for the ✕ must not open the sheet instead.
                if (removing) {
                  return (
                    <div key={key} className="sheet-thumb">
                      {card.kind === "sheet" ? (
                        <SheetThumbnail items={card.items} />
                      ) : (
                        <PhotoImage card={card} urls={urls} />
                      )}
                      {caption}
                      <button
                        type="button"
                        className="btn btn-small btn-danger sheet-remove"
                        disabled={busyId === key}
                        onClick={() => void remove(card)}
                      >
                        {busyId === key
                          ? "Removing…"
                          : card.kind === "sheet"
                            ? "Delete sheet"
                            : "Delete photo"}
                      </button>
                    </div>
                  );
                }

                return card.kind === "sheet" ? (
                  <Link
                    key={key}
                    href={`/inspections/view?id=${card.id}`}
                    className="sheet-thumb"
                  >
                    <SheetThumbnail items={card.items} />
                    {caption}
                  </Link>
                ) : (
                  <PhotoCard key={key} card={card} urls={urls}>
                    {caption}
                  </PhotoCard>
                );
              })}
            </div>
          </div>
        ))}

        {total > 0 && (
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

function PhotoImage({
  card,
  urls,
}: {
  card: Extract<Card, { kind: "photo" }>;
  urls: Record<string, string>;
}) {
  const url = urls[card.path];
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Sheet for ${card.machine}`} />
  ) : (
    <span className="sheet-loading">…</span>
  );
}

function PhotoCard({
  card,
  urls,
  children,
}: {
  card: Extract<Card, { kind: "photo" }>;
  urls: Record<string, string>;
  children: React.ReactNode;
}) {
  const url = urls[card.path];
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="sheet-thumb"
      onClick={(ev) => {
        if (!url) ev.preventDefault();
      }}
    >
      <PhotoImage card={card} urls={urls} />
      {children}
    </a>
  );
}
