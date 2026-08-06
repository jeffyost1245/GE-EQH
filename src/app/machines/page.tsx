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

  function startAdd() {
    setEditId(NEW);
    setEditName("");
    setEditUnit("");
    setEditType("");
    setError("");
    setInfo("");
  }

  function startEdit(m: Machine) {
    setEditId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit_no ?? "");
    setEditType(m.machine_type ?? "");
    setError("");
    setInfo("");
  }

  async function saveEdit() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const unit = editUnit.trim() ? normalizeUnit(editUnit) : null;
    const details = { unit_no: unit, machine_type: editType || null };

    setBusy(true);
    setError("");
    try {
      if (editId === NEW) {
        // Somebody else in the company may already have this machine.
        // Attaching to it is what keeps one hour meter per machine.
        const existing = unit ? await findMachineByUnit(unit) : null;
        if (existing) {
          await attachMachine(existing.id);
          setEditId("");
          setInfo(
            `${existing.unit_no} is already in the company fleet as "${existing.name}" — added it to your list rather than creating a second one. Its hours carry over.`
          );
          await refresh();
          return;
        }
        await addMachine(trimmed, details);
      } else {
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
          sometimes with a letter, like 741 or 871R. If the company already
          has this number, it gets added to your list rather than created
          again, and its hours carry over.
        </p>

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
            disabled={busy || !editName.trim()}
            onClick={() => void saveEdit()}
          >
            {isNew ? "Add machine" : "Save"}
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
