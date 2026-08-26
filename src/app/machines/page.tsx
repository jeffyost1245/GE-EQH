"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import LockAdmin from "@/components/LockAdmin";
import {
  addMachine,
  attachMachine,
  crewsHolding,
  detachMachine,
  findMachineByUnit,
  listMachines,
  machinesNotHeld,
  renameMachine,
  setMachineDetails,
  setMachineStatus,
} from "@/lib/data";
import {
  MACHINE_TYPES,
  normalizeUnit,
  typeLabel,
} from "@/lib/machineTypes";
import { Machine } from "@/lib/types";

/** Sentinel for the editor being open on a machine that doesn't exist yet. */
const NEW = "new";

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline editor: name plus the identity fields, edited together.
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editType, setEditType] = useState("");

  // What the company already has under the number being typed.
  // undefined means "haven't looked"; null means "looked, nothing there".
  const [match, setMatch] = useState<Machine | null | undefined>(undefined);
  const [matchHolders, setMatchHolders] = useState<string[]>([]);
  const [looking, setLooking] = useState(false);

  // The fleet, for picking a machine off it instead of describing one.
  const [fleet, setFleet] = useState<Machine[] | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMachines(await listMachines(false));
      setError("");
    } catch {
      setError("Can't load machines — no signal.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Look the number up while it's being typed, not when Add is pressed.
   * The machine is already in the database with its make, model and
   * hours; making a foreman retype all of that to find out it was there
   * all along is the thing this avoids.
   */
  useEffect(() => {
    const unit = editUnit.trim();
    if (editId !== NEW || unit.length < 2) {
      setMatch(undefined);
      setMatchHolders([]);
      return;
    }
    let cancelled = false;
    setLooking(true);
    const timer = setTimeout(() => {
      findMachineByUnit(normalizeUnit(unit))
        .then(async (found) => {
          if (cancelled) return;
          setMatch(found);
          setMatchHolders(found ? await crewsHolding(found.id).catch(() => []) : []);
        })
        // Offline: say nothing rather than claim the number is free.
        .catch(() => {
          if (!cancelled) setMatch(undefined);
        })
        .finally(() => {
          if (!cancelled) setLooking(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editId, editUnit]);

  function startAdd() {
    setEditId(NEW);
    setEditName("");
    setEditUnit("");
    setEditType("");
    setMatch(undefined);
    setError("");
    setInfo("");
  }

  function startEdit(m: Machine) {
    setEditId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit_no ?? "");
    setEditType(m.machine_type ?? "");
    setMatch(undefined);
    setError("");
    setInfo("");
  }

  /** Put a machine already in the fleet onto this crew's list. */
  async function take(m: Machine) {
    setBusy(true);
    setError("");
    try {
      await attachMachine(m.id);
      setEditId("");
      setBrowsing(false);
      setInfo(`Added ${m.unit_no ?? m.name} to your list. Its hours carry over.`);
      await refresh();
    } catch {
      setError("Couldn't add it — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openBrowse() {
    setBrowsing(true);
    setError("");
    setInfo("");
    try {
      setFleet(await machinesNotHeld());
    } catch {
      setFleet(null);
      setError("Can't read the company fleet — no signal.");
    }
  }

  async function saveEdit() {
    const trimmed = editName.trim();
    const unit = editUnit.trim() ? normalizeUnit(editUnit) : null;
    const details = { unit_no: unit, machine_type: editType || null };
    // A machine already in the fleet needs no description, so the name is
    // only required for one the company has never seen.
    if (!trimmed && !(editId === NEW && unit)) return;

    setBusy(true);
    setError("");
    try {
      if (editId === NEW) {
        // Checked again here rather than trusting what the field showed:
        // another crew may have entered it in the meantime, and attaching
        // to it is what keeps one hour meter per machine.
        const existing = unit ? await findMachineByUnit(unit) : null;
        if (existing) {
          await attachMachine(existing.id);
          setEditId("");
          setInfo(
            `${existing.unit_no} is already in the company fleet as "${existing.name}" — added it to your list rather than creating a second one. Its hours carry over. If this is a different machine that inherited the number, retire the old one first.`
          );
          await refresh();
          return;
        }
        if (!trimmed) {
          setError(
            `${unit} isn't in the company fleet yet. Fill in the make and model to add it.`
          );
          setBusy(false);
          return;
        }
        await addMachine(trimmed, details);
      } else {
        // Editing is the other way a duplicate gets made: a machine added
        // blank, or renumbered later, never went through the lookup that
        // adding does. Two records for one machine means two hour meters.
        const clash = unit ? await findMachineByUnit(unit, editId) : null;
        if (clash) {
          setError(
            `${unit} is currently ${clash.name}. Two machines in service can't share a number — if this is that machine, hand this one back and add ${unit} instead. If it took the number over, retire ${clash.name} first.`
          );
          setBusy(false);
          return;
        }
        const machine = (machines ?? []).find((m) => m.id === editId);
        if (machine && trimmed !== machine.name) {
          await renameMachine(editId, trimmed);
        }
        await setMachineDetails(editId, details);
      }
      setEditId("");
      await refresh();
    } catch {
      setError(
        "Couldn't save — check your signal and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: Machine) {
    const next = m.status === "active" ? "inactive" : "active";
    setInfo("");
    try {
      await setMachineStatus(m.id, next);
      await refresh();
    } catch {
      setError("Couldn't update — check your signal and try again.");
    }
  }

  /**
   * Hand a machine back. It leaves this crew's list and stays in the
   * company fleet with every hour ever logged on it — which is why there
   * is no confirmation to lose work over.
   */
  async function remove(m: Machine) {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await detachMachine(m.id);
      const others = await crewsHolding(m.id).catch(() => []);
      setInfo(
        others.length
          ? `Took ${m.unit_no ?? m.name} off your list. ${others.join(" and ")} still ${others.length === 1 ? "has" : "have"} it.`
          : `Took ${m.unit_no ?? m.name} off your list. Nobody has it now — it shows as unassigned on the fleet board.`
      );
      await refresh();
    } catch {
      setError("Couldn't do that — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  const active = (machines ?? []).filter((m) => m.status === "active");
  const retired = (machines ?? []).filter((m) => m.status === "inactive");
  const unnumbered = active.filter((m) => !m.unit_no).length;

  /** One form for both adding a machine and editing one. */
  function editor(isNew: boolean) {
    const found = isNew ? (match ?? null) : null;
    return (
      <div className="machine-edit">
        <label htmlFor="e-unit">Unit number</label>
        <input
          id="e-unit"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          placeholder="925"
          value={editUnit}
          autoFocus
          onChange={(e) => setEditUnit(e.target.value)}
        />
        <p className="small muted">
          The company&apos;s number for this machine — three characters,
          sometimes with a letter, like 741 or 871R. Type it and it looks
          the machine up: if the company already has it, you don&apos;t
          need to fill in anything else.
        </p>

        {isNew && looking && <p className="small muted">Checking the fleet…</p>}

        {isNew && found ? (
          // Already company iron. Everything below would be ignored, so
          // it isn't asked for.
          <div className="notice notice-ok">
            <div className="machine-line">
              {found.unit_no && <span className="unit-no">{found.unit_no}</span>}
              <span className="stat-name">{found.name}</span>
            </div>
            <p className="small" style={{ margin: "6px 0 0" }}>
              {found.machine_type
                ? `${typeLabel(found.machine_type)} · `
                : ""}
              {matchHolders.length
                ? `${matchHolders.join(" and ")} ${
                    matchHolders.length === 1 ? "has" : "have"
                  } it`
                : "nobody has it right now"}
            </p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              Already in the company fleet. Adding it puts it on your list
              with every hour ever logged on it.
            </p>
          </div>
        ) : (
          <>
            <label htmlFor="e-name">Make and model</label>
            <input
              id="e-name"
              type="text"
              placeholder="John Deere 624R"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <label htmlFor="e-type">Type</label>
            <select
              id="e-type"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
            >
              <option value="">Choose type…</option>
              {MACHINE_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </>
        )}

        {isNew && !found && !looking && match === null && (
          <p className="small muted">
            {normalizeUnit(editUnit)} isn&apos;t in the fleet yet — filling
            this in is what puts it there.
          </p>
        )}

        {isNew && !editUnit.trim() && (
          <p className="small muted">
            You can leave the number blank for now, but the whole fleet list
            hangs off it — a machine without one can&apos;t be matched to the
            same machine on another crew.
          </p>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          <button
            className="btn btn-small"
            disabled={busy || (!found && !editName.trim())}
            onClick={() => void saveEdit()}
          >
            {isNew ? (found ? `Add ${found.unit_no ?? found.name}` : "Add machine") : "Save"}
          </button>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => setEditId("")}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function row(m: Machine, retiredRow: boolean) {
    if (editId === m.id) {
      return <div key={m.id}>{editor(false)}</div>;
    }
    return (
      <div className="list-row" key={m.id}>
        <span className={retiredRow ? "inactive-name grow" : "grow"}>
          <span className="machine-line">
            {m.unit_no && <span className="unit-no">{m.unit_no}</span>}
            <span className="stat-name">{m.name}</span>
          </span>
          {m.machine_type && (
            <span className="machine-sub">{typeLabel(m.machine_type)}</span>
          )}
        </span>
        <div className="row-actions">
          <button
            className="btn btn-small btn-secondary"
            onClick={() => startEdit(m)}
          >
            Edit
          </button>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => void toggle(m)}
          >
            {retiredRow ? "Reactivate" : "Retire"}
          </button>
          <button
            className="btn btn-small btn-danger"
            disabled={busy}
            onClick={() => void remove(m)}
          >
            Hand back
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Machines">
      <div className="admin-bar">
        <span className="muted small">Admin unlocked</span>
        <LockAdmin />
      </div>
      {error && <p className="error">{error}</p>}
      {info && <p className="notice">{info}</p>}

      {machines && unnumbered > 0 && (
        <p className="notice">
          {unnumbered} {unnumbered === 1 ? "machine has" : "machines have"} no
          unit number yet. Tap Edit and add it — it&apos;s what lets the
          company tell two of the same machine apart.
        </p>
      )}

      {editId === NEW ? (
        <div className="card">{editor(true)}</div>
      ) : (
        <button className="btn" onClick={startAdd}>
          + Add a machine
        </button>
      )}

      {editId !== NEW &&
        (browsing ? (
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>Company fleet</h3>
              <button className="linkish" onClick={() => setBrowsing(false)}>
                Close
              </button>
            </div>
            <p className="muted small">
              Machines the company has that aren&apos;t on your list. Taking
              one on brings its hours with it.
            </p>
            {!fleet && <p className="muted">Reading the fleet…</p>}
            {fleet?.length === 0 && (
              <p className="muted">
                You already have every machine in the fleet.
              </p>
            )}
            {fleet?.map((m) => (
              <div className="list-row" key={m.id}>
                <span className="grow">
                  <span className="machine-line">
                    {m.unit_no && <span className="unit-no">{m.unit_no}</span>}
                    <span className="stat-name">{m.name}</span>
                  </span>
                  {m.machine_type && (
                    <span className="machine-sub">
                      {typeLabel(m.machine_type)}
                    </span>
                  )}
                </span>
                <div className="row-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    disabled={busy}
                    onClick={() => void take(m)}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => void openBrowse()}
          >
            Pick from the company fleet
          </button>
        ))}

      <h2>Active</h2>
      <div className="card">
        {active.length === 0 && <p className="muted">No active machines.</p>}
        {active.map((m) => row(m, false))}
      </div>

      {retired.length > 0 && (
        <>
          <h2>Retired</h2>
          <div className="card">
            <p className="muted small">
              Retired machines are hidden from the dropdowns; their history
              stays. Retiring affects the whole company, not just your crew —
              hand a machine back instead if another crew still runs it.
            </p>
            {retired.map((m) => row(m, true))}
          </div>
        </>
      )}
    </AppShell>
  );
}
