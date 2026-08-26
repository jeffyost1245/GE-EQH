"use client";

// New iron, entered by the superintendent.
//
// A foreman adding a machine is adding it to his list. This is the other
// case: a machine arrives at the company and belongs to nobody's crew
// yet. It goes into the fleet unassigned, shows on the board with no
// hours, and the first crew to take it on picks it up by its number.

import { useState } from "react";
import { addMachine, findMachineByUnit } from "@/lib/data";
import { MACHINE_TYPES, normalizeUnit, typeLabel } from "@/lib/machineTypes";

export default function AddFleetMachine({
  onAdded,
}: {
  onAdded: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function reset() {
    setUnit("");
    setName("");
    setType("");
    setError("");
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const number = unit.trim() ? normalizeUnit(unit) : null;

    setBusy(true);
    setError("");
    try {
      // One machine per number while it is in service. Entering a second
      // 311R here would split one machine's hours across two records.
      if (number) {
        const taken = await findMachineByUnit(number);
        if (taken) {
          setError(
            `${number} is already in the fleet as "${taken.name}". If this is a different machine that took the number over, a foreman retires the old one first — that frees the number.`
          );
          setBusy(false);
          return;
        }
      }

      await addMachine(
        trimmedName,
        { unit_no: number, machine_type: type || null },
        { attach: false }
      );
      setInfo(
        `${number ?? trimmedName} is in the fleet, unassigned. A crew picks it up by its number on their Machines screen.`
      );
      reset();
      setOpen(false);
      await onAdded();
    } catch {
      setError("Couldn't add it — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        {info && <p className="notice notice-ok">{info}</p>}
        <button
          className="btn btn-secondary"
          onClick={() => {
            setOpen(true);
            setInfo("");
          }}
        >
          + Add a machine
        </button>
      </>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>New machine</h3>
      {error && <p className="error">{error}</p>}

      <label htmlFor="f-unit">Unit number</label>
      <input
        id="f-unit"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        placeholder="925"
        value={unit}
        autoFocus
        onChange={(e) => setUnit(e.target.value)}
      />

      <label htmlFor="f-name">Make and model</label>
      <input
        id="f-name"
        type="text"
        placeholder="John Deere 624R"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label htmlFor="f-type">Type</label>
      <select
        id="f-type"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">Choose type…</option>
        {MACHINE_TYPES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <p className="small muted">
        {type
          ? `It joins the ${typeLabel(type)} group on the board, unassigned and with no hours, until a crew takes it on.`
          : "Without a type it sits at the bottom of the board instead of with its own kind."}
      </p>

      <div className="row" style={{ marginTop: 14 }}>
        <button
          className="btn btn-small"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
        >
          {busy ? "Adding…" : "Add to fleet"}
        </button>
        <button
          className="btn btn-small btn-secondary"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
