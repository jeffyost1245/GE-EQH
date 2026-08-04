"use client";

// Every flagged repair across every crew, from both places one can come
// from: an RR on a checkout sheet, and an hours entry flagged as needing
// work. Plus entries whose notes read like a repair but were never
// flagged — offered as suggestions rather than folded in, because the
// wording is a guess, and a maintenance list that quietly invents items
// is worse than one that misses a few.

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import {
  allInspectionRepairs,
  allRepairs,
  flagRepair,
  repairSuggestions,
  setInspectionRepairDone,
  setRepairDone,
} from "@/lib/data";
import { flaggedItems } from "@/lib/inspection";
import { EntryWithNames, InspectionWithNames } from "@/lib/types";
import { formatDate } from "@/lib/week";

type Tab = "open" | "suggested" | "done";

/** One row on the list, whichever kind of record it came from. */
interface RepairItem {
  id: string;
  source: "entry" | "sheet";
  machine: string;
  crewName: string;
  operator: string;
  date: string;
  /** What was reported, in the operator's words. */
  said: string;
  repairNote: string | null;
  aside: string | null;
}

function fromEntry(e: EntryWithNames): RepairItem {
  return {
    id: e.id,
    source: "entry",
    machine: e.machines?.name ?? "Unknown machine",
    crewName: e.foremen?.name ?? "Unknown crew",
    operator: e.crew?.name ?? "Unknown",
    date: e.date,
    said: e.note ?? "",
    repairNote: e.repair_note,
    aside: e.job_tag ? e.job_tag : e.photo_path ? "Checkout sheet photo attached" : null,
  };
}

function fromInspection(s: InspectionWithNames): RepairItem {
  const flagged = flaggedItems(s.items);
  return {
    id: s.id,
    source: "sheet",
    machine: s.machines?.name ?? "Unknown machine",
    crewName: s.foremen?.name ?? "Unknown crew",
    operator: s.crew?.name ?? "Unknown",
    date: s.date,
    said: flagged
      .map((f) => (f.note ? `${f.item} — ${f.note}` : f.item))
      .join("\n"),
    repairNote: s.repair_note,
    aside: `Checkout sheet${s.hour_meter != null ? ` · ${s.hour_meter} hrs` : ""}`,
  };
}

function byNewest(a: RepairItem, b: RepairItem): number {
  return b.date.localeCompare(a.date);
}

export default function MaintenancePage() {
  const [tab, setTab] = useState<Tab>("open");
  const [open, setOpen] = useState<RepairItem[]>([]);
  const [done, setDone] = useState<RepairItem[]>([]);
  const [suggested, setSuggested] = useState<RepairItem[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const [entriesOpen, entriesDone, guesses, sheetsOpen, sheetsDone] =
        await Promise.all([
          allRepairs(false),
          allRepairs(true),
          repairSuggestions(),
          // Fail soft: before the inspections migration runs there is no
          // such table, and the entry-based list still works without it.
          allInspectionRepairs(false).catch(() => [] as InspectionWithNames[]),
          allInspectionRepairs(true).catch(() => [] as InspectionWithNames[]),
        ]);
      setOpen(
        [...entriesOpen.map(fromEntry), ...sheetsOpen.map(fromInspection)].sort(
          byNewest
        )
      );
      setDone(
        [...entriesDone.map(fromEntry), ...sheetsDone.map(fromInspection)].sort(
          byNewest
        )
      );
      setSuggested(guesses.map(fromEntry));
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

      {list.map((item) => {
        const close = (isDone: boolean) =>
          item.source === "sheet"
            ? setInspectionRepairDone(item.id, isDone)
            : setRepairDone(item.id, isDone);
        return (
          <div className="card repair" key={`${item.source}-${item.id}`}>
            <div className="entry-top">
              <span>{item.machine}</span>
              <span className="muted small">{formatDate(item.date)}</span>
            </div>
            <div className="entry-sub">
              {item.crewName} · {item.operator}
              {item.aside ? ` · ${item.aside}` : ""}
            </div>
            {item.said && <p className="repair-note">“{item.said}”</p>}
            {item.repairNote && (
              <p className="small muted">Repair note: {item.repairNote}</p>
            )}

            <div className="row" style={{ marginTop: 10 }}>
              {tab === "suggested" && (
                <button
                  className="btn btn-small"
                  disabled={busyId === item.id}
                  onClick={() => void act(item.id, () => flagRepair(item.id))}
                >
                  Add to open
                </button>
              )}
              {tab === "open" && (
                <button
                  className="btn btn-small"
                  disabled={busyId === item.id}
                  onClick={() => void act(item.id, () => close(true))}
                >
                  Mark done
                </button>
              )}
              {tab === "done" && (
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busyId === item.id}
                  onClick={() => void act(item.id, () => close(false))}
                >
                  Reopen
                </button>
              )}
            </div>
          </div>
        );
      })}
    </AppShell>
  );
}
