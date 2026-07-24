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
  setMachineStatus,
} from "@/lib/data";
import { Machine } from "@/lib/types";

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // inline rename state
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");

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
    setError("");
    setInfo("");
  }

  async function saveEdit() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await renameMachine(editId, trimmed);
      setEditId("");
      await refresh();
    } catch {
      setError("Couldn't rename — check your signal and try again.");
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

  function row(m: Machine, retiredRow: boolean) {
    if (editId === m.id) {
      return (
        <div className="list-row" key={m.id}>
          <input
            type="text"
            className="grow"
            value={editName}
            autoFocus
            onChange={(e) => setEditName(e.target.value)}
          />
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
      );
    }
    return (
      <div className="list-row" key={m.id}>
        <span className={retiredRow ? "inactive-name grow" : "stat-name grow"}>
          {m.name}
        </span>
        <div className="row-actions">
          <button
            className="btn btn-small btn-secondary"
            onClick={() => startEdit(m)}
          >
            Rename
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
