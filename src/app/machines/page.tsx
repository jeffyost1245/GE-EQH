"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import LockAdmin from "@/components/LockAdmin";
import {
  addMachine,
  deleteMachine,
  listMachines,
  machineEntryCount,
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

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline editor: name plus the identity fields, edited together.
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editModel, setEditModel] = useState("");
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setInfo("");
    try {
      await addMachine(name.trim());
      setName("");
      await refresh();
    } catch {
      setError("Couldn't add machine — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(m: Machine) {
    setEditId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit_no ?? "");
    setEditModel(m.make_model ?? "");
    setEditType(m.machine_type ?? "");
    setError("");
    setInfo("");
  }

  async function saveEdit() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const machine = (machines ?? []).find((m) => m.id === editId);
      if (machine && trimmed !== machine.name) {
        await renameMachine(editId, trimmed);
      }
      await setMachineDetails(editId, {
        unit_no: editUnit.trim() ? normalizeUnit(editUnit) : null,
        make_model: editModel.trim() || null,
        machine_type: editType || null,
      });
      setEditId("");
      await refresh();
    } catch {
      setError(
        "Couldn't save. If the unit number fields are new to you, the database migration may not have been run yet."
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

  async function remove(m: Machine) {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const count = await machineEntryCount(m.id);
      if (count > 0) {
        setInfo(
          `"${m.name}" has ${count} logged ${
            count === 1 ? "entry" : "entries"
          }, so it can't be deleted — that history stays. Retire it instead to hide it from the dropdowns.`
        );
        return;
      }
      if (
        !window.confirm(`Delete "${m.name}" permanently? This can't be undone.`)
      ) {
        return;
      }
      await deleteMachine(m.id);
      await refresh();
    } catch {
      setError("Couldn't delete — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  const active = (machines ?? []).filter((m) => m.status === "active");
  const retired = (machines ?? []).filter((m) => m.status === "inactive");
  const unnumbered = active.filter((m) => !m.unit_no).length;

  function row(m: Machine, retiredRow: boolean) {
    if (editId === m.id) {
      return (
        <div className="machine-edit" key={m.id}>
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
            sometimes with a letter, like 741 or 871R.
          </p>

          <label htmlFor="e-name">Name</label>
          <input
            id="e-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />

          <label htmlFor="e-model">Make and model</label>
          <input
            id="e-model"
            type="text"
            placeholder="John Deere 510"
            value={editModel}
            onChange={(e) => setEditModel(e.target.value)}
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

          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-small"
              disabled={busy || !editName.trim()}
              onClick={() => void saveEdit()}
            >
              Save
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
    return (
      <div className="list-row" key={m.id}>
        <span className={retiredRow ? "inactive-name grow" : "grow"}>
          <span className="machine-line">
            {m.unit_no && <span className="unit-no">{m.unit_no}</span>}
            <span className="stat-name">{m.name}</span>
          </span>
          {(m.machine_type || m.make_model) && (
            <span className="machine-sub">
              {[typeLabel(m.machine_type ?? null), m.make_model]
                .filter(Boolean)
                .join(" · ")}
            </span>
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
            Delete
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

      <form className="card row" onSubmit={add}>
        <input
          type="text"
          className="grow"
          placeholder="New machine name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-small" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>

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
              Retired machines are hidden from dropdowns; their history stays.
              Delete only works on machines with no logged hours.
            </p>
            {retired.map((m) => row(m, true))}
          </div>
        </>
      )}
    </AppShell>
  );
}
