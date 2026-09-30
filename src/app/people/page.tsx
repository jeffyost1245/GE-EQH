"use client";

// The office: everybody who works here, and which crew they're on.
//
// This is where employee numbers get filled in, and it exists before
// anything uses them — the numbers have to be in before they can be
// typed. One person, one number, one row. Retiring the row is what takes
// somebody's access away when they leave, which is the whole reason for
// doing this.
//
// Grouped by crew because that is how the company is organised and how
// the login will ask for it: pick your crew, type your number.

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import CrewBar from "@/components/CrewBar";
import {
  addPerson,
  allCrews,
  allPeople,
  findPersonByNumber,
  setPersonStatus,
  updatePerson,
} from "@/lib/data";
import { describeError } from "@/lib/errors";
import { Foreman, PersonRole, PersonWithCrew } from "@/lib/types";

const NEW = "new";

const ROLE_LABEL: Record<PersonRole, string> = {
  hand: "Hand",
  foreman: "Foreman",
  superintendent: "Superintendent",
};

const ROLE_NOTE: Record<PersonRole, string> = {
  hand: "Logs hours and fills out checkout sheets.",
  foreman: "That, plus the machine list and the crew list.",
  superintendent: "Reads across every crew. No crew screens.",
};

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonWithCrew[] | null>(null);
  const [crews, setCrews] = useState<Foreman[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  // One editor, opened either on an existing person or on a blank row
  // belonging to a particular crew.
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState({
    name: "",
    employee_no: "",
    role: "hand" as PersonRole,
    foreman_id: "",
  });

  const refresh = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([allPeople(), allCrews()]);
      setPeople(p);
      setCrews(c);
      setError("");
    } catch (cause) {
      setError(describeError(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startAdd(foremanId: string) {
    setEditId(NEW);
    setForm({ name: "", employee_no: "", role: "hand", foreman_id: foremanId });
    setError("");
    setInfo("");
  }

  function startEdit(person: PersonWithCrew) {
    setEditId(person.id);
    setForm({
      name: person.name,
      employee_no: person.employee_no ?? "",
      role: person.role ?? "hand",
      foreman_id: person.foreman_id,
    });
    setError("");
    setInfo("");
  }

  async function save() {
    const name = form.name.trim();
    if (!name || !form.foreman_id) return;
    const number = form.employee_no.trim() || null;

    setBusy(true);
    setError("");
    try {
      // Two people on one number means two people signing in as one, and
      // every entry after that is attributed to the wrong man.
      if (number) {
        const clash = await findPersonByNumber(
          number,
          editId === NEW ? undefined : editId
        );
        if (clash) {
          setError(
            `${number} is already ${clash.name}${
              clash.foremen?.name ? ` on ${clash.foremen.name}'s crew` : ""
            }. Retire that row first if the number has been reissued.`
          );
          setBusy(false);
          return;
        }
      }

      const fields = {
        name,
        employee_no: number,
        role: form.role,
        foreman_id: form.foreman_id,
      };
      if (editId === NEW) await addPerson(fields);
      else await updatePerson(editId, fields);

      setEditId("");
      setInfo(
        number
          ? `Saved ${name} — number ${number}.`
          : `Saved ${name}. No number yet, so they can't sign in once numbers go live.`
      );
      await refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function retire(person: PersonWithCrew, next: "active" | "inactive") {
    if (
      next === "inactive" &&
      !window.confirm(
        `Retire ${person.name}? Their hours and sheets stay; their number stops working.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await setPersonStatus(person.id, next);
      setInfo(
        next === "inactive"
          ? `${person.name} is retired. ${
              person.employee_no
                ? `Number ${person.employee_no} is free to reissue.`
                : ""
            }`
          : `${person.name} is back on.`
      );
      await refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  const byCrew = useMemo(() => {
    const groups = new Map<string, PersonWithCrew[]>();
    for (const person of people ?? []) {
      if (person.status !== "active" && !showRetired) continue;
      groups.set(person.foreman_id, [
        ...(groups.get(person.foreman_id) ?? []),
        person,
      ]);
    }
    return groups;
  }, [people, showRetired]);

  const active = (people ?? []).filter((p) => p.status === "active");
  const missing = active.filter((p) => !p.employee_no).length;

  function editor() {
    return (
      <div className="machine-edit">
        <label htmlFor="p-no">Employee number</label>
        <input
          id="p-no"
          type="text"
          inputMode="numeric"
          placeholder="1245"
          value={form.employee_no}
          autoFocus
          onChange={(e) => setForm({ ...form, employee_no: e.target.value })}
        />

        <label htmlFor="p-name">Name</label>
        <input
          id="p-name"
          type="text"
          placeholder="Kyle Berger"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <label htmlFor="p-crew">Crew</label>
        <select
          id="p-crew"
          value={form.foreman_id}
          onChange={(e) => setForm({ ...form, foreman_id: e.target.value })}
        >
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="p-role">Access</label>
        <select
          id="p-role"
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as PersonRole })
          }
        >
          {(Object.keys(ROLE_LABEL) as PersonRole[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
        <p className="small muted">{ROLE_NOTE[form.role]}</p>

        <div className="row" style={{ marginTop: 14 }}>
          <button
            className="btn btn-small"
            disabled={busy || !form.name.trim()}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
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
    <AppShell title="Office">
      <CrewBar />
      {error && <p className="error">{error}</p>}
      {info && <p className="notice notice-ok">{info}</p>}

      {people && missing > 0 && (
        <p className="notice">
          {missing} {missing === 1 ? "person has" : "people have"} no employee
          number yet. Until they do, they can&apos;t sign in once numbers go
          live.
        </p>
      )}

      {!people && !error && <p className="muted">Reading the roster…</p>}

      {people && (
        <div className="sheets-tools">
          <button
            type="button"
            className="linkish"
            onClick={() => setShowRetired((on) => !on)}
          >
            {showRetired ? "Hide retired" : "Show retired"}
          </button>
        </div>
      )}

      {crews
        .filter((crew) => crew.role !== "owner")
        .map((crew) => {
          const members = byCrew.get(crew.id) ?? [];
          return (
            <section key={crew.id}>
              <h2>
                {crew.name}
                {crew.status !== "active" && " (retired)"}
              </h2>
              <div className="card">
                {members.length === 0 && (
                  <p className="muted small">Nobody on this crew yet.</p>
                )}

                {members.map((person) =>
                  editId === person.id ? (
                    <div key={person.id}>{editor()}</div>
                  ) : (
                    <div className="list-row" key={person.id}>
                      <span
                        className={
                          person.status === "active"
                            ? "grow"
                            : "inactive-name grow"
                        }
                      >
                        <span className="machine-line">
                          {person.employee_no ? (
                            <span className="unit-no">
                              {person.employee_no}
                            </span>
                          ) : (
                            <span className="badge badge-open">no number</span>
                          )}
                          <span className="stat-name">{person.name}</span>
                        </span>
                        {person.role && person.role !== "hand" && (
                          <span className="machine-sub">
                            {ROLE_LABEL[person.role]}
                          </span>
                        )}
                      </span>
                      <div className="row-actions">
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => startEdit(person)}
                        >
                          Edit
                        </button>
                        <button
                          className={
                            person.status === "active"
                              ? "btn btn-small btn-danger"
                              : "btn btn-small btn-secondary"
                          }
                          disabled={busy}
                          onClick={() =>
                            void retire(
                              person,
                              person.status === "active" ? "inactive" : "active"
                            )
                          }
                        >
                          {person.status === "active" ? "Retire" : "Bring back"}
                        </button>
                      </div>
                    </div>
                  )
                )}

                {editId === NEW && form.foreman_id === crew.id ? (
                  editor()
                ) : (
                  <button
                    className="btn btn-small btn-secondary"
                    style={{ marginTop: 12 }}
                    onClick={() => startAdd(crew.id)}
                  >
                    + Add someone
                  </button>
                )}
              </div>
            </section>
          );
        })}

      <p className="small muted">
        A number is what somebody types to sign in, so it has to match the
        company&apos;s. Retiring a person keeps every hour and every sheet
        they ever logged and stops the number working — that is how access
        is taken away when somebody leaves.
      </p>
    </AppShell>
  );
}
