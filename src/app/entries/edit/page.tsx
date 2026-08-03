"use client";

// Edit any entry after the fact — wrong hours, wrong date, late notes.
// Also the place to close out an open entry (fill in end hours). Saves
// bump updated_at. Uses a query param (?id=) rather than a bracketed
// dynamic route so it deploys reliably.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import SheetPhotoField from "@/components/SheetPhotoField";
import {
  getEntry,
  listCrew,
  listMachines,
  saveEntryUpdate,
  setEntryPhoto,
} from "@/lib/data";
import { CrewMember, EntryWithNames, Machine } from "@/lib/types";

function EditEntry() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();

  const [entry, setEntry] = useState<EntryWithNames | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loadError, setLoadError] = useState("");

  const [machineId, setMachineId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState("");
  const [startHours, setStartHours] = useState("");
  const [endHours, setEndHours] = useState("");
  const [note, setNote] = useState("");
  const [jobTag, setJobTag] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [needsRepair, setNeedsRepair] = useState(false);

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedQueued, setSavedQueued] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoadError("No entry selected.");
      return;
    }
    (async () => {
      try {
        const [e, m, c] = await Promise.all([
          getEntry(id),
          // include inactive so old entries keep their machine/person
          listMachines(false),
          listCrew(false),
        ]);
        if (!e) {
          setLoadError("Entry not found.");
          return;
        }
        setEntry(e);
        setMachines(m);
        setCrew(c);
        setMachineId(e.machine_id);
        setCrewId(e.crew_member_id);
        setDate(e.date);
        setStartHours(String(e.start_hours));
        setEndHours(e.end_hours != null ? String(e.end_hours) : "");
        setNote(e.note ?? "");
        setJobTag(e.job_tag ?? "");
        setPhotoPath(e.photo_path ?? null);
        setNeedsRepair(e.needs_repair ?? false);
      } catch {
        setLoadError("Can't load this entry — no signal.");
      }
    })();
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const start = Number(startHours);
    const end = endHours === "" ? null : Number(endHours);
    if (startHours === "" || Number.isNaN(start)) {
      setSaveError("Start hours is required.");
      return;
    }
    if (end !== null && (Number.isNaN(end) || end < start)) {
      setSaveError("End hours must be a number, and not less than start hours.");
      return;
    }
    setBusy(true);
    const result = await saveEntryUpdate(id, {
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
    if (result === "synced") {
      router.push("/entries");
    } else {
      setSavedQueued(true);
    }
  }

  return (
    <AppShell title="Edit Entry">
      {loadError && <p className="notice">{loadError}</p>}
      {savedQueued && (
        <p className="notice">
          📶 No signal — change saved on this phone and will sync
          automatically.
        </p>
      )}
      {entry && (
        <form className="card" onSubmit={submit}>
          {entry.end_hours_autofilled && (
            <p className="small muted">
              ⓘ End hours on this entry were auto-filled from the next
              entry&apos;s start hours.
            </p>
          )}
          <label htmlFor="machine">Machine</label>
          <select
            id="machine"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.status === "inactive" ? " (retired)" : ""}
              </option>
            ))}
          </select>

          <label htmlFor="name">Crew member</label>
          <select
            id="name"
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
          >
            {crew.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "inactive" ? " (former)" : ""}
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

          <label htmlFor="start">Start hours</label>
          <input
            id="start"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={startHours}
            onChange={(e) => setStartHours(e.target.value)}
          />

          <label htmlFor="end">End hours</label>
          <input
            id="end"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={endHours}
            onChange={(e) => setEndHours(e.target.value)}
            placeholder="Still open"
          />

          <label htmlFor="job">Job / project</label>
          <input
            id="job"
            type="text"
            value={jobTag}
            onChange={(e) => setJobTag(e.target.value)}
          />

          <label htmlFor="note">Note</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <SheetPhotoField
            value={photoPath}
            onChange={(path) => {
              setPhotoPath(path);
              // Persist right away so a photo added here isn't lost if the
              // form is closed without saving; Save Changes also sends it.
              void setEntryPhoto(id, path).catch(() => {});
            }}
          />

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
            {busy ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </form>
      )}
    </AppShell>
  );
}

export default function EditEntryPage() {
  return (
    <Suspense fallback={<AppShell title="Edit Entry">Loading…</AppShell>}>
      <EditEntry />
    </Suspense>
  );
}
