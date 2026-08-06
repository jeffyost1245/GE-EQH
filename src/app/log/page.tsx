"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import SheetPhotoField from "@/components/SheetPhotoField";
import {
  inspectionForDay,
  latestEntryForMachine,
  listCrew,
  listMachines,
  saveEntry,
} from "@/lib/data";
import { cacheGet, cacheSet } from "@/lib/cache";
import { machineLabel } from "@/lib/machineTypes";
import { clearDraft, saveDraft, takeDraft } from "@/lib/draft";
import { formatDate, formatHours, todayString } from "@/lib/week";
import {
  CrewMember,
  EntryWithNames,
  InspectionWithNames,
  Machine,
} from "@/lib/types";
import { currentCrew } from "@/lib/tenant";

type LatestCache = Record<
  string,
  { end_hours: number | null; date: string } | null
>;

const NAME_KEY = "eqh_my_name";

function LogForm() {
  const params = useSearchParams();
  const resuming = params.get("resume") === "1";

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

  const [prevEntry, setPrevEntry] = useState<EntryWithNames | null>(null);
  const [prevFromCache, setPrevFromCache] = useState(false);

  /** Today's checkout sheet for the chosen machine, if anyone has done it. */
  const [sheet, setSheet] = useState<InspectionWithNames | null>(null);
  const [sheetChecked, setSheetChecked] = useState(false);
  const restored = useRef(false);
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

  // Coming back from the checkout sheet: put the entry back the way it
  // was left, rather than making someone retype it after 35 questions.
  useEffect(() => {
    if (!resuming || restored.current) return;
    restored.current = true;
    const draft = takeDraft();
    if (!draft) return;
    setMachineId(draft.machineId);
    setCrewId(draft.crewId);
    setDate(draft.date);
    setStartHours(draft.startHours);
    setEndHours(draft.endHours);
    setNote(draft.note);
    setJobTag(draft.jobTag);
    setPhotoPath(draft.photoPath);
    setNeedsRepair(draft.needsRepair);
  }, [resuming]);

  /** Has anyone done this machine's checkout for this day yet? */
  useEffect(() => {
    let cancelled = false;
    setSheet(null);
    setSheetChecked(false);
    if (!machineId) return;
    inspectionForDay(machineId, date)
      .then((found) => {
        if (cancelled) return;
        setSheet(found);
        setSheetChecked(true);
      })
      // Offline, or the table isn't there: say nothing rather than
      // claiming the check hasn't been done.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [machineId, date]);

  /** Park the half-filled entry before leaving for the sheet. */
  function parkDraft() {
    saveDraft({
      machineId,
      crewId,
      date,
      startHours,
      endHours,
      note,
      jobTag,
      photoPath,
      needsRepair,
    });
  }

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
    clearDraft();
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

  /**
   * Whose reading this is. One machine has one meter, so the number may
   * well come from another crew — saying so stops it looking like a bug.
   */
  function whoLast(entry: EntryWithNames): string {
    const crew = entry.foremen?.name;
    return !crew || crew === currentCrew()?.name
      ? "the last entry"
      : `${crew}'s crew`;
  }

  return (
    <AppShell title="Log Hours">
      {loadError && <p className="notice">{loadError}</p>}
      {resuming && !saved && (
        <p className="notice notice-ok">
          ✓ Checkout sheet done. Your hours are still here — finish them and
          hit Save.
        </p>
      )}
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
          key={`machine-${machines.length}`}
          value={machineId}
          onChange={(e) => void selectMachine(e.target.value)}
        >
          <option value="">Choose machine…</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {machineLabel(m)}
            </option>
          ))}
        </select>

        <label htmlFor="name">Your name</label>
        <select
          id="name"
          key={`name-${crew.length}`}
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
            Prefilled from {whoLast(prevEntry)} ({formatDate(prevEntry.date)},
            ended at {formatHours(prevEntry.end_hours)}). Change it if the
            meter reads different.
          </p>
        )}
        {prevFromCache && (
          <p className="small muted">
            Prefilled from the last reading saved on this phone (no signal).
          </p>
        )}
        {willBackfill && (
          <p className="notice">
            {whoLast(prevEntry!)} left this machine&apos;s{" "}
            {formatDate(prevEntry!.date)} entry open. Your start hours will
            close it out.
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

          {sheet ? (
            <>
              <p className="sheet-done">
                ✓ Already done today by{" "}
                <strong>{sheet.crew?.name ?? "someone"}</strong>
                {sheet.signed_at &&
                  ` at ${new Date(sheet.signed_at).toLocaleTimeString(
                    undefined,
                    { hour: "numeric", minute: "2-digit" }
                  )}`}
                .
              </p>
              <div className="row">
                <Link
                  className="btn btn-small btn-secondary"
                  href={`/inspections/view?id=${sheet.id}`}
                >
                  See it
                </Link>
                <Link
                  className="btn btn-small btn-secondary"
                  onClick={parkDraft}
                  href={`/inspect?machine=${machineId}&date=${date}&from=log`}
                >
                  Something changed
                </Link>
              </div>
              <p className="small muted">
                One sheet covers the machine for the day. If something broke
                since, open it and mark it — the sheet updates rather than a
                second one being filed.
              </p>
            </>
          ) : (
            <>
              <Link
                className="btn btn-small btn-secondary"
                onClick={parkDraft}
                href={
                  machineId
                    ? `/inspect?machine=${machineId}&date=${date}&from=log`
                    : "/inspect"
                }
              >
                📋 Fill it out here
              </Link>
              <p className="small muted">
                {machineId && sheetChecked
                  ? "Nobody has done this machine today. What you've typed here is kept while you fill it out."
                  : "Or photograph the paper one — either works, and anything marked RR goes on the shop list the same way."}
              </p>
            </>
          )}
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

export default function LogPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Log Hours">
          <p className="muted">Loading…</p>
        </AppShell>
      }
    >
      <LogForm />
    </Suspense>
  );
}
