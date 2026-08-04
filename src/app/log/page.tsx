"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import SheetPhotoField from "@/components/SheetPhotoField";
import { latestEntryForMachine, listCrew, listMachines, saveEntry } from "@/lib/data";
import { cacheGet, cacheSet } from "@/lib/cache";
import { formatDate, formatHours, todayString } from "@/lib/week";
import { CrewMember, Entry, Machine } from "@/lib/types";

type LatestCache = Record<
  string,
  { end_hours: number | null; date: string } | null
>;

const NAME_KEY = "eqh_my_name";

export default function LogPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loadError, setLoadError] = useState("");

  const [machineId, setMachineId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(todayString());
  const [startHours, setStartHours] = useState("");
  const [endHours, setEndHours] = useState("");
  const [note, setNote] = useState("");
  const [jobTag, setJobTag] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [needsRepair, setNeedsRepair] = useState(false);

  const [prevEntry, setPrevEntry] = useState<Entry | null>(null);
  const [prevFromCache, setPrevFromCache] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<"" | "synced" | "queued">("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [m, c] = await Promise.all([listMachines(true), listCrew(true)]);
        setMachines(m);
        setCrew(c);
        cacheSet("machines", m);
        cacheSet("crew", c);
      } catch {
        // offline — fall back to the last lists we saw
        const m = cacheGet<Machine[]>("machines");
        const c = cacheGet<CrewMember[]>("crew");
        if (m && c) {
          setMachines(m);
          setCrew(c);
          setLoadError("No signal — using saved machine and crew lists.");
        } else {
          setLoadError(
            "Can't load machines and crew (no signal, and nothing cached yet)."
          );
        }
      }
      const savedName = window.localStorage.getItem(NAME_KEY);
      if (savedName) setCrewId(savedName);
    })();
  }, []);

  const selectMachine = useCallback(async (id: string) => {
    setMachineId(id);
    setPrevEntry(null);
    setPrevFromCache(false);
    setStartHours("");
    if (!id) return;
    try {
      const prev = await latestEntryForMachine(id);
      setPrevEntry(prev);
      if (prev?.end_hours != null) setStartHours(String(prev.end_hours));
      const latest = cacheGet<LatestCache>("latest") ?? {};
      latest[id] = prev
        ? { end_hours: prev.end_hours, date: prev.date }
        : null;
      cacheSet("latest", latest);
    } catch {
      // offline — best-effort prefill from the last successful lookup
      const cached = (cacheGet<LatestCache>("latest") ?? {})[id];
      if (cached?.end_hours != null) {
        setStartHours(String(cached.end_hours));
        setPrevFromCache(true);
      }
    }
  }, []);

  function pickName(id: string) {
    setCrewId(id);
    window.localStorage.setItem(NAME_KEY, id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const start = Number(startHours);
    const end = endHours === "" ? null : Number(endHours);
    if (!machineId || !crewId || startHours === "" || Number.isNaN(start)) {
      setSaveError("Pick a machine, pick your name, and enter start hours.");
      return;
    }
    if (end !== null && (Number.isNaN(end) || end < start)) {
      setSaveError("End hours must be a number, and not less than start hours.");
      return;
    }
    setBusy(true);
    const result = await saveEntry({
      machine_id: machineId,
      crew_member_id: crewId,
      date,
      start_hours: start,
      end_hours: end,
      note: note.trim() || null,
      job_tag: jobTag.trim() || null,
      photo_path: photoPath,
      needs_repair: needsRepair,
    });
    setBusy(false);
    setSaved(result);
    // reset for the next entry, keeping name and date
    setMachineId("");
    setStartHours("");
    setEndHours("");
    setNote("");
    setJobTag("");
    setPhotoPath(null);
    setNeedsRepair(false);
    setPrevEntry(null);
    setPrevFromCache(false);
  }

  const willBackfill = prevEntry !== null && prevEntry.end_hours === null;

  return (
    <AppShell title="Log Hours">
      {loadError && <p className="notice">{loadError}</p>}
      {saved && (
        <p className={saved === "synced" ? "notice notice-ok" : "notice"}>
          {saved === "synced"
            ? "✓ Entry saved."
            : "📶 No signal — entry saved on this phone and will sync automatically."}
        </p>
      )}
      <form className="card" onSubmit={submit}>
        <label htmlFor="machine">Machine</label>
        <select
          id="machine"
          value={machineId}
          onChange={(e) => void selectMachine(e.target.value)}
        >
          <option value="">Choose machine…</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <label htmlFor="name">Your name</label>
        <select
          id="name"
          value={crewId}
          onChange={(e) => pickName(e.target.value)}
        >
          <option value="">Choose name…</option>
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <label htmlFor="start">Start hours (machine meter)</label>
        <input
          id="start"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={startHours}
          onChange={(e) => setStartHours(e.target.value)}
          placeholder={machineId ? "Read the meter" : "Pick a machine first"}
        />
        {prevEntry && prevEntry.end_hours != null && (
          <p className="small muted">
            Prefilled from the last entry ({formatDate(prevEntry.date)}, ended
            at {formatHours(prevEntry.end_hours)}). Change it if the meter
            reads different.
          </p>
        )}
        {prevFromCache && (
          <p className="small muted">
            Prefilled from the last reading saved on this phone (no signal).
          </p>
        )}
        {willBackfill && (
          <p className="notice">
            The last entry for this machine ({formatDate(prevEntry!.date)}) was
            never closed out. Your start hours will be used to fill in its end
            hours automatically.
          </p>
        )}

        <label htmlFor="end">End hours (optional — fill in when done)</label>
        <input
          id="end"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={endHours}
          onChange={(e) => setEndHours(e.target.value)}
          placeholder="Leave blank, finish later"
        />

        <label htmlFor="job">Job / project (optional)</label>
        <input
          id="job"
          type="text"
          value={jobTag}
          onChange={(e) => setJobTag(e.target.value)}
          placeholder="e.g. Smith driveway"
        />

        <label htmlFor="note">Note (optional)</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was it used for?"
        />

        <div className="sheet-choice">
          <label>Checkout sheet</label>
          <Link
            className="btn btn-small btn-secondary"
            href={
              machineId
                ? `/inspect?machine=${machineId}&date=${date}`
                : "/inspect"
            }
          >
            📋 Fill it out here
          </Link>
          <p className="small muted">
            Or photograph the paper one — either works, and anything marked
            RR goes on the shop list the same way.
          </p>
        </div>

        <SheetPhotoField value={photoPath} onChange={setPhotoPath} />

        <label className="check">
          <input
            type="checkbox"
            checked={needsRepair}
            onChange={(e) => setNeedsRepair(e.target.checked)}
          />
          <span>
            Needs repair
            <span className="muted small"> — puts it on the shop list</span>
          </span>
        </label>

        {saveError && <p className="error">{saveError}</p>}
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save Entry"}
        </button>
      </form>
    </AppShell>
  );
}
