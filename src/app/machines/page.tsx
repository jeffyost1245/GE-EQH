"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { addMachine, listMachines, setMachineStatus } from "@/lib/data";
import { Machine } from "@/lib/types";

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function toggle(m: Machine) {
    const next = m.status === "active" ? "inactive" : "active";
    try {
      await setMachineStatus(m.id, next);
      await refresh();
    } catch {
      setError("Couldn't update — check your signal and try again.");
    }
  }

  const active = (machines ?? []).filter((m) => m.status === "active");
  const retired = (machines ?? []).filter((m) => m.status === "inactive");

  return (
    <AppShell title="Machines">
      {error && <p className="notice">{error}</p>}
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
        {active.map((m) => (
          <div className="list-row" key={m.id}>
            <span className="stat-name">{m.name}</span>
            <button
              className="btn btn-small btn-secondary"
              onClick={() => void toggle(m)}
            >
              Retire
            </button>
          </div>
        ))}
      </div>

      {retired.length > 0 && (
        <>
          <h2>Retired</h2>
          <div className="card">
            <p className="muted small">
              Retired machines are hidden from dropdowns; their history stays.
            </p>
            {retired.map((m) => (
              <div className="list-row" key={m.id}>
                <span className="inactive-name">{m.name}</span>
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => void toggle(m)}
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
