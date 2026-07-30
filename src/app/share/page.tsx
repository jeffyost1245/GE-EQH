"use client";

// Public read-only view of one week's checkout sheets, opened from a
// share link. No crew password, no navigation into the rest of the app —
// the token is the only thing that grants access, and it expires.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { entriesForWeek, getShareLink } from "@/lib/data";
import { sheetPhotoUrls } from "@/lib/photo";
import { EntryWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      weekStart: string;
      weekEnd: string;
      days: [string, EntryWithNames[]][];
      urls: Record<string, string>;
    };

function SharedSheets() {
  const token = useSearchParams().get("t") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      if (!token) {
        setState({ kind: "error", message: "This link is incomplete." });
        return;
      }
      try {
        const link = await getShareLink(token);
        if (!link) {
          setState({ kind: "error", message: "This link is not valid." });
          return;
        }
        if (new Date(link.expires_at) < new Date()) {
          setState({
            kind: "error",
            message:
              "This link has expired. Ask the foreman to send a new one.",
          });
          return;
        }

        const entries = await entriesForWeek(
          link.week_start,
          link.week_end,
          link.foreman_id
        );
        const withPhotos = entries.filter((e) => e.photo_path);
        const urls = await sheetPhotoUrls(
          withPhotos.map((e) => e.photo_path!)
        );

        const map = new Map<string, EntryWithNames[]>();
        for (const e of withPhotos) {
          map.set(e.date, [...(map.get(e.date) ?? []), e]);
        }
        setState({
          kind: "ready",
          weekStart: link.week_start,
          weekEnd: link.week_end,
          days: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])),
          urls,
        });
      } catch {
        setState({
          kind: "error",
          message: "Couldn't load these sheets. Check your connection.",
        });
      }
    })();
  }, [token]);

  if (state.kind === "loading") {
    return <p className="muted">Loading checkout sheets…</p>;
  }

  if (state.kind === "error") {
    return <p className="notice">{state.message}</p>;
  }

  const total = state.days.reduce((n, [, items]) => n + items.length, 0);

  return (
    <>
      <p className="muted small" style={{ marginTop: -10 }}>
        Week of {formatDate(state.weekStart)} – {formatDate(state.weekEnd)} ·{" "}
        {total} {total === 1 ? "sheet" : "sheets"}
      </p>

      {total === 0 && (
        <p className="muted">No checkout sheets were logged this week.</p>
      )}

      {state.days.map(([date, items]) => (
        <section key={date}>
          <h2>{formatDate(date)}</h2>
          {items.map((e) => {
            const url = e.photo_path ? state.urls[e.photo_path] : undefined;
            return (
              <div className="card" key={e.id}>
                <div className="entry-top">
                  <span>{e.machines?.name ?? "Unknown machine"}</span>
                  <span className="muted small">{e.crew?.name ?? ""}</span>
                </div>
                {e.job_tag && <div className="entry-sub">{e.job_tag}</div>}
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Checkout sheet for ${e.machines?.name}`}
                      className="sheet-full"
                    />
                  </a>
                ) : (
                  <p className="muted small">Photo unavailable.</p>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <p className="muted small">
        Tap any sheet to open it full size, then use your phone&apos;s share
        or save button.
      </p>
    </>
  );
}

export default function SharePage() {
  return (
    <div className="shell">
      <h1>📋 Equipment Checkout Sheets</h1>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <SharedSheets />
      </Suspense>
    </div>
  );
}
