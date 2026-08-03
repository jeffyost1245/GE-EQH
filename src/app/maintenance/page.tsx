"use client";

// Every flagged repair across every crew, plus entries whose notes read
// like a repair but were never flagged. Those are offered as suggestions
// rather than folded in: the wording is a guess, and a maintenance list
// that quietly invents items is worse than one that misses a few.

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import {
  allRepairs,
  flagRepair,
  repairSuggestions,
  setRepairDone,
} from "@/lib/data";
import { EntryWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

type Tab = "open" | "suggested" | "done";

export default function MaintenancePage() {
  const [tab, setTab] = useState<Tab>("open");
  const [open, setOpen] = useState<EntryWithNames[]>([]);
  const [done, setDone] = useState<EntryWithNames[]>([]);
  const [suggested, setSuggested] = useState<EntryWithNames[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const [o, d, s] = await Promise.all([
        allRepairs(false),
        allRepairs(true),
        repairSuggestions(),
      ]);
      setOpen(o);
      setDone(d);
      setSuggested(s);
    } catch {
      setError("Can't reach the server — check your signal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch {
      setError("Couldn't save that — check your signal and try again.");
    } finally {
      setBusyId("");
    }
  }

  const list = tab === "open" ? open : tab === "done" ? done : suggested;

  return (
    <AppShell title="Maintenance">
      <CrewBar />

      <div className="tabs">
        {(
          [
            ["open", `Open (${open.length})`],
            ["suggested", `Suggested (${suggested.length})`],
            ["done", `Done (${done.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "tab active" : "tab"}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="notice">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {tab === "suggested" && suggested.length > 0 && (
        <p className="muted small">
          Notes that mention something wrong but were never flagged. Adding
          one puts it on the open list.
        </p>
      )}

      {!loading && list.length === 0 && (
        <p className="muted">
          {tab === "open"
            ? "Nothing open. Everything's been handled."
            : tab === "suggested"
              ? "No unflagged notes look like repairs."
              : "Nothing closed out yet."}
        </p>
      )}

      {list.map((e) => (
        <div className="card repair" key={e.id}>
          <div className="entry-top">
            <span>{e.machines?.name ?? "Unknown machine"}</span>
            <span className="muted small">{formatDate(e.date)}</span>
          </div>
          <div className="entry-sub">
            {e.foremen?.name ?? "Unknown crew"} · {e.crew?.name ?? "Unknown"}
            {e.job_tag ? ` · ${e.job_tag}` : ""}
          </div>
          {e.note && <p className="repair-note">“{e.note}”</p>}
          {e.repair_note && (
            <p className="small muted">Repair note: {e.repair_note}</p>
          )}
          {e.photo_path && (
            <p className="small muted">📋 Checkout sheet attached</p>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            {tab === "suggested" && (
              <button
                className="btn btn-small"
                disabled={busyId === e.id}
                onClick={() => void act(e.id, () => flagRepair(e.id))}
              >
                Add to open
              </button>
            )}
            {tab === "open" && (
              <button
                className="btn btn-small"
                disabled={busyId === e.id}
                onClick={() => void act(e.id, () => setRepairDone(e.id, true))}
              >
                Mark done
              </button>
            )}
            {tab === "done" && (
              <button
                className="btn btn-small btn-secondary"
                disabled={busyId === e.id}
                onClick={() => void act(e.id, () => setRepairDone(e.id, false))}
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      ))}
    </AppShell>
  );
}
