"use client";

// The board itself: rows in, panel out. Kept apart from the page so the
// layout can be rendered from any set of rows — including a known one,
// which is the only way to check it looks right without a live fleet.

import {
  FleetRow,
  FleetStatus,
  IDLE_THRESHOLD,
  STATUS_LABEL,
} from "@/lib/fleet";
import { MACHINE_TYPES, isAttachment } from "@/lib/machineTypes";

const RANK: Record<FleetStatus, number> = {
  available: 0,
  unused: 1,
  down: 2,
  working: 3,
  stock: 4,
};

export default function FleetBoard({ rows }: { rows: FleetRow[] }) {
  const groups: { key: string; label: string; rows: FleetRow[] }[] = [];
  for (const type of MACHINE_TYPES) {
    const inType = rows.filter((r) => r.machine.machine_type === type.key);
    if (inType.length) {
      groups.push({ key: type.key, label: type.label, rows: sort(inType) });
    }
  }
  const untyped = rows.filter(
    (r) => !MACHINE_TYPES.some((t) => t.key === r.machine.machine_type)
  );
  if (untyped.length) {
    groups.push({ key: "untyped", label: "No type set", rows: sort(untyped) });
  }

  const available = rows.filter((r) => r.status === "available").length;
  const down = rows.filter((r) => r.status === "down").length;

  return (
    <div className="board">
      <div className="board-head">
        <span className="board-title">Fleet Status</span>
        <span className="board-when">{rows.length} machines</span>
      </div>

      <div className="board-counts">
        <div className="board-count">
          <b className="is-available">{available}</b>
          <span>Available</span>
        </div>
        <div className="board-count">
          <b className="is-down">{down}</b>
          <span>Down</span>
        </div>
        <div className="board-count">
          <b>{IDLE_THRESHOLD}</b>
          <span>Idle limit</span>
        </div>
      </div>

      {groups.map((group) => (
        <div className="board-group" key={group.key}>
          <div className="board-group-head">
            <span>{group.label}</span>
            <span>{group.rows.length}</span>
          </div>
          {group.rows.map((row) => (
            <Row key={row.machine.id} row={row} />
          ))}
        </div>
      ))}

      {groups.length === 0 && <p className="board-empty">No active machines.</p>}
    </div>
  );
}

function Row({ row }: { row: FleetRow }) {
  const { machine } = row;
  const attachment = isAttachment(machine.machine_type ?? null);

  return (
    <div className={`board-row is-${row.status}`}>
      <span className="board-unit">{machine.unit_no ?? "\u2014"}</span>
      <span className="board-name">
        {machine.name}
        <span className="board-sub">
          {row.crew}
          {row.job && ` \u00b7 ${row.job}`}
        </span>
      </span>
      <span className="board-status">
        <span className={`board-flag is-${row.status}`}>
          {STATUS_LABEL[row.status]}
        </span>
        {!attachment && (
          <span className="board-idle">
            {row.idleDays === null
              ? "never run"
              : row.idleDays === 0
                ? "today"
                : `${row.idleDays}d idle`}
          </span>
        )}
      </span>
    </div>
  );
}

function sort(rows: FleetRow[]): FleetRow[] {
  return [...rows].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      (b.idleDays ?? 0) - (a.idleDays ?? 0) ||
      (a.machine.unit_no ?? "").localeCompare(b.machine.unit_no ?? "")
  );
}
