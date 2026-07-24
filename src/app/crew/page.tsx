"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { addCrewMember, listCrew, setCrewStatus } from "@/lib/data";
import { CrewMember } from "@/lib/types";

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function toggle(c: CrewMember) {
    const next = c.status === "active" ? "inactive" : "active";
    try {
      await setCrewStatus(c.id, next);
      await refresh();
    } catch {
      setError("Couldn't update — check your signal and try again.");
    }
  }

  const active = (crew ?? []).filter((c) => c.status === "active");
  const former = (crew ?? []).filter((c) => c.status === "inactive");

  return (
    <AppShell title="Crew">
      {error && <p className="notice">{error}</p>}
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
        {active.map((c) => (
          <div className="list-row" key={c.id}>
            <span className="stat-name">{c.name}</span>
            <button
              className="btn btn-small btn-secondary"
              onClick={() => void toggle(c)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {former.length > 0 && (
        <>
          <h2>Former crew</h2>
          <div className="card">
            <p className="muted small">
              Removed people are hidden from the name dropdown; their old
              entries stay attributed to them.
            </p>
            {former.map((c) => (
              <div className="list-row" key={c.id}>
                <span className="inactive-name">{c.name}</span>
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => void toggle(c)}
                >
                  Re-add
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
