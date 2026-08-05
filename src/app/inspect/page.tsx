"use client";

// The digital checkout sheet. Same questions as the paper, in the same
// order, built for a thumb: one tap per item, one tap to clear a whole
// section that's fine, and it won't submit half-answered.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import SignaturePad from "@/components/SignaturePad";
import {
  inspectionForDay,
  latestEntryForMachine,
  listCrew,
  listMachines,
  saveInspection,
  todaysJobFields,
} from "@/lib/data";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  SECTIONS,
  TOTAL_ITEMS,
  countAnswered,
  defectSummary,
  flaggedItems,
  itemKey,
} from "@/lib/inspection";
import { todayString } from "@/lib/week";
import {
  CrewMember,
  InspectionItems,
  Machine,
  Mark,
  Signature,
} from "@/lib/types";

const NAME_KEY = "eqh_my_name";

function InspectForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loadError, setLoadError] = useState("");

  const [machineId, setMachineId] = useState(params.get("machine") ?? "");
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(params.get("date") ?? todayString());

  const [location, setLocation] = useState("");
  const [shift, setShift] = useState("");
  const [jobNo, setJobNo] = useState("");
  const [jobName, setJobName] = useState("");
  const [hourMeter, setHourMeter] = useState("");
  const [mileage, setMileage] = useState("");

  const [items, setItems] = useState<InspectionItems>({});
  const [extra, setExtra] = useState("");
  const [signature, setSignature] = useState<Signature | null>(null);
  const [overrideNeeded, setOverrideNeeded] = useState(false);

  const [existingId, setExistingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, c] = await Promise.all([listMachines(true), listCrew(true)]);
        setMachines(m);
        setCrew(c);
        cacheSet("machines", m);
        cacheSet("crew", c);
      } catch {
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

  /** Load the day's sheet if there is one, otherwise prefill a fresh one. */
  const loadSheet = useCallback(async (machine: string, day: string) => {
    setExistingId(null);
    if (!machine) return;
    try {
      const existing = await inspectionForDay(machine, day);
      if (existing) {
        setExistingId(existing.id);
        setCrewId(existing.crew_member_id ?? "");
        setLocation(existing.location ?? "");
        setShift(existing.shift ?? "");
        setJobNo(existing.job_no ?? "");
        setJobName(existing.job_name ?? "");
        setHourMeter(existing.hour_meter == null ? "" : String(existing.hour_meter));
        setMileage(existing.mileage ?? "");
        setItems(existing.items ?? {});
        setSignature(existing.signature);
        setOverrideNeeded(existing.repairs_needed);
        return;
      }

      const [job, prev] = await Promise.all([
        todaysJobFields(day),
        latestEntryForMachine(machine),
      ]);
      if (job) {
        setLocation((v) => v || job.location || "");
        setShift((v) => v || job.shift || "");
        setJobNo((v) => v || job.job_no || "");
        setJobName((v) => v || job.job_name || "");
      }
      if (prev) {
        const reading = prev.end_hours ?? prev.start_hours;
        if (reading != null) setHourMeter(String(reading));
      }
    } catch {
      // Offline: an empty sheet is still fillable, and it queues on save.
    }
  }, []);

  useEffect(() => {
    void loadSheet(machineId, date);
  }, [machineId, date, loadSheet]);

  function mark(key: string, value: Mark) {
    setItems((prev) => {
      const next = { ...prev };
      const note = next[key]?.note;
      next[key] = value === "rr" ? { mark: value, note: note ?? "" } : { mark: value };
      return next;
    });
  }

  function setNote(key: string, note: string) {
    setItems((prev) => ({ ...prev, [key]: { mark: "rr", note } }));
  }

  function allOk(sectionKey: string) {
    setItems((prev) => {
      const next = { ...prev };
      const section = SECTIONS.find((s) => s.key === sectionKey)!;
      for (const item of section.items) {
        const key = itemKey(sectionKey, item.name);
        // Never overwrite a flagged item — clearing a section shouldn't
        // quietly un-report something the operator already found.
        if (next[key]?.mark !== "rr") next[key] = { mark: "ok" };
      }
      return next;
    });
  }

  const answered = countAnswered(items);
  const flagged = useMemo(() => flaggedItems(items), [items]);
  const repairsNeeded = flagged.length > 0 || overrideNeeded;
  const complete = answered === TOTAL_ITEMS;
  const machineName = machines.find((m) => m.id === machineId)?.name ?? "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!machineId) return setError("Pick a machine.");
    if (!crewId) return setError("Pick your name.");
    if (!complete) {
      return setError(
        `${TOTAL_ITEMS - answered} item${
          TOTAL_ITEMS - answered === 1 ? "" : "s"
        } still unanswered.`
      );
    }
    if (flagged.some((f) => !f.note)) {
      return setError("Say what's wrong with each item you marked RR.");
    }
    if (!signature) return setError("Sign the sheet before submitting.");

    setBusy(true);
    const result = await saveInspection({
      machine_id: machineId,
      crew_member_id: crewId,
      date,
      location: location.trim() || null,
      shift: shift.trim() || null,
      job_no: jobNo.trim() || null,
      job_name: jobName.trim() || null,
      hour_meter: hourMeter === "" ? null : Number(hourMeter),
      mileage: mileage.trim() || null,
      items,
      defects: [defectSummary(items), extra.trim()].filter(Boolean).join("\n\n") || null,
      repairs_needed: repairsNeeded,
      signature,
      signed_at: new Date().toISOString(),
    });
    setBusy(false);

    if (result.status === "synced") {
      router.push(`/inspections/view?id=${result.saved.id}`);
    } else {
      setQueued(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <AppShell title="Checkout Sheet">
      {loadError && <p className="notice">{loadError}</p>}
      {queued && (
        <p className="notice">
          📶 No signal — the sheet is saved on this phone and will send
          itself when you get service. You can close the app.
        </p>
      )}
      {existingId && (
        <p className="notice notice-ok">
          This machine already has a sheet for this day. Changes update it
          rather than filing a second one.
        </p>
      )}

      <form onSubmit={submit}>
        {/* Rides along as you work down the list — the count is only
            useful while there are still items to answer, which is
            exactly when it would otherwise be scrolled off the screen. */}
        <div className="insp-sticky">
          <span className={complete ? "insp-done" : undefined}>
            {complete
              ? `All ${TOTAL_ITEMS} answered`
              : `${TOTAL_ITEMS - answered} of ${TOTAL_ITEMS} left`}
          </span>
          {flagged.length > 0 && (
            <span className="insp-flagcount">
              {flagged.length} needs repair
            </span>
          )}
        </div>

        <div className="card">
          <label htmlFor="machine">Machine</label>
          <select
            id="machine"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          >
            <option value="">Choose machine…</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <label htmlFor="operator">Your name</label>
          <select
            id="operator"
            value={crewId}
            onChange={(e) => {
              setCrewId(e.target.value);
              window.localStorage.setItem(NAME_KEY, e.target.value);
            }}
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

          <label htmlFor="meter">Hour meter</label>
          <input
            id="meter"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={hourMeter}
            onChange={(e) => setHourMeter(e.target.value)}
            placeholder={machineId ? "Read the meter" : "Pick a machine first"}
          />

          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Job site"
          />

          <div className="row">
            <div className="grow">
              <label htmlFor="jobno">Job #</label>
              <input
                id="jobno"
                type="text"
                inputMode="numeric"
                value={jobNo}
                onChange={(e) => setJobNo(e.target.value)}
              />
            </div>
            <div className="grow">
              <label htmlFor="shift">Shift</label>
              <input
                id="shift"
                type="text"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                placeholder="Day"
              />
            </div>
          </div>

          <label htmlFor="jobname">Job name</label>
          <input
            id="jobname"
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
          />

          <label htmlFor="mileage">Mileage (only if it has an odometer)</label>
          <input
            id="mileage"
            type="text"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="—"
          />
          <p className="small muted">
            Location and job carry over from the last sheet your crew filled
            out today.
          </p>
        </div>

        {SECTIONS.map((section) => {
          const remaining = section.items.filter(
            (i) => !items[itemKey(section.key, i.name)]
          ).length;
          return (
            <div key={section.key}>
              <h2>{section.title}</h2>
              <div className="card">
                <button
                  type="button"
                  className="btn btn-small btn-secondary allok"
                  onClick={() => allOk(section.key)}
                  disabled={remaining === 0}
                >
                  {remaining === 0
                    ? "Section done"
                    : `All ${remaining} OK`}
                </button>

                {section.items.map((item) => {
                  const key = itemKey(section.key, item.name);
                  const answer = items[key];
                  return (
                    <div
                      key={key}
                      className={`insp-item${
                        answer?.mark === "rr" ? " flagged" : ""
                      }`}
                    >
                      <div className="insp-row">
                        <span className="insp-name">
                          {item.name}
                          {item.hint && (
                            <span className="muted small"> — {item.hint}</span>
                          )}
                        </span>
                        <span className="seg" role="group" aria-label={item.name}>
                          {(["na", "ok", "rr"] as Mark[]).map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={`seg-btn seg-${value}${
                                answer?.mark === value ? " on" : ""
                              }`}
                              aria-pressed={answer?.mark === value}
                              onClick={() => mark(key, value)}
                            >
                              {value === "na" ? "N/A" : value.toUpperCase()}
                            </button>
                          ))}
                        </span>
                      </div>
                      {answer?.mark === "rr" && (
                        <input
                          type="text"
                          className="insp-note"
                          value={answer.note ?? ""}
                          onChange={(e) => setNote(key, e.target.value)}
                          placeholder="What's wrong with it?"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <h2>Anything else</h2>
        <div className="card">
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Optional — anything the mechanic should know that isn't on the list."
          />
        </div>

        <h2>Operator</h2>
        <div className="card">
          <p className="insp-verdict">
            {repairsNeeded
              ? "Repairs or adjustments needed."
              : "Repairs or adjustments NOT needed for safe equipment operation."}
          </p>
          {flagged.length === 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={overrideNeeded}
                onChange={(e) => setOverrideNeeded(e.target.checked)}
              />
              <span>
                It still needs work
                <span className="muted small">
                  {" "}
                  — something not on the list above
                </span>
              </span>
            </label>
          )}

          <label>Your signature</label>
          <SignaturePad value={signature} onChange={setSignature} />
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !complete}>
          {busy ? "Saving…" : `Submit ${machineName || "Sheet"}`}
        </button>
      </form>
    </AppShell>
  );
}

export default function InspectPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Checkout Sheet">
          <p className="muted">Loading…</p>
        </AppShell>
      }
    >
      <InspectForm />
    </Suspense>
  );
}
