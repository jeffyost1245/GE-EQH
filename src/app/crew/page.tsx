"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  addCrewMember,
  crewEntryCount,
  deleteCrewMember,
  listCrew,
  renameCrewMember,
  setCrewStatus,
} from "@/lib/data";
import { CrewMember } from "@/lib/types";

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // inline rename state
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");

  const refresh = useCallback(async () => {
    try {
      setCrew(await listCrew(false));
      setError("");
    } catch {
      setError("Can't load crew — no signal.");
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
      await addCrewMember(name.trim());
      setName("");
      await refresh();
    } catch {
      setError("Couldn't add crew member — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: CrewMember) {
    setEditId(c.id);
    setEditName(c.name);
    setError("");
    setInfo("");
  }

  async function saveEdit() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await renameCrewMember(editId, trimmed);
      setEditId("");
      await refresh();
    } catch {
      setError("Couldn't rename — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: CrewMember) {
    const next = c.status === "active" ? "inactive" : "active";
    setInfo("");
    try {
      await setCrewStatus(c.id, next);
      await refresh();
    } catch {
      setError("Couldn't update — check your signal and try again.");
    }
  }

  async function remove(c: CrewMember) {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const count = await crewEntryCount(c.id);
      if (count > 0) {
        setInfo(
          `"${c.name}" has ${count} logged ${
            count === 1 ? "entry" : "entries"
          }, so they can't be deleted — that history stays. Remove them instead to hide them from the name dropdown.`
        );
        return;
      }
      if (
        !window.confirm(`Delete "${c.name}" permanently? This can't be undone.`)
      ) {
        return;
      }
      await deleteCrewMember(c.id);
      await refresh();
    } catch {
      setError("Couldn't delete — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  const active = (crew ?? []).filter((c) => c.status === "active");
  const former = (crew ?? []).filter((c) => c.status === "inactive");

  function row(c: CrewMember, formerRow: boolean) {
    if (editId === c.id) {
      return (
        <div className="list-row" key={c.id}>
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
      <div className="list-row" key={c.id}>
        <span className={formerRow ? "inactive-name grow" : "stat-name grow"}>
          {c.name}
        </span>
        <div className="row-actions">
          <button
            className="btn btn-small btn-secondary"
            onClick={() => startEdit(c)}
          >
            Rename
          </button>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => void toggle(c)}
          >
            {formerRow ? "Re-add" : "Remove"}
          </button>
          <button
            className="btn btn-small btn-danger"
            disabled={busy}
            onClick={() => void remove(c)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Crew">
      {error && <p className="error">{error}</p>}
      {info && <p className="notice">{info}</p>}
      <form className="card row" onSubmit={add}>
        <input
          type="text"
          className="grow"
          placeholder="New crew member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-small" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>

      <h2>Active crew</h2>
      <div className="card">
        {active.length === 0 && <p className="muted">No active crew.</p>}
        {active.map((c) => row(c, false))}
      </div>

      {former.length > 0 && (
        <>
          <h2>Former crew</h2>
          <div className="card">
            <p className="muted small">
              Removed people are hidden from the name dropdown; their old
              entries stay attributed to them. Delete only works on people with
              no logged hours.
            </p>
            {former.map((c) => row(c, true))}
          </div>
        </>
      )}
    </AppShell>
  );
}
