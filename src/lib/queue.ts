// Offline queue: entry saves that fail (spotty signal) are kept in
// localStorage and retried when the connection returns. Queue survives
// page reloads; it syncs on app load, on the browser's "online" event,
// and on a slow interval.

import { NewEntry, NewInspection } from "./types";

export interface PendingCreate {
  kind: "create";
  localId: string;
  entry: NewEntry;
  queuedAt: string;
}

export interface PendingUpdate {
  kind: "update";
  localId: string;
  entryId: string;
  patch: Partial<NewEntry>;
  queuedAt: string;
}

/**
 * A whole checkout sheet, queued as one unit. It replays as an upsert
 * keyed on machine and date, so filling one out in a dead zone and again
 * on the way back to the yard leaves one sheet, not two.
 */
export interface PendingInspection {
  kind: "inspection";
  localId: string;
  inspection: NewInspection;
  queuedAt: string;
}

export type PendingOp = PendingCreate | PendingUpdate | PendingInspection;

const KEY = "eqh_pending_ops";
const LISTENERS = new Set<() => void>();

function read(): PendingOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(ops: PendingOp[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ops));
  LISTENERS.forEach((fn) => fn());
}

export function pendingOps(): PendingOp[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

export function enqueue(op: PendingOp) {
  write([...read(), op]);
}

export function dequeue(localId: string) {
  write(read().filter((op) => op.localId !== localId));
}

export function onQueueChange(fn: () => void): () => void {
  LISTENERS.add(fn);
  return () => LISTENERS.delete(fn);
}

export function newLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
