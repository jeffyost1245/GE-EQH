// The half-filled hours entry, parked while you go do the checkout sheet.
//
// Filling out the sheet means leaving the log screen, and coming back to
// an empty form after answering thirty-five questions is the kind of
// thing that stops people using the sheet at all. The draft is written
// on the way out and taken back on the way in.
//
// Deliberately not a general autosave: it is restored only when you come
// back from the sheet, so nobody opens Log Hours to find yesterday's
// half-finished entry sitting there.

const KEY = "eqh_log_draft";

export interface LogDraft {
  machineId: string;
  crewId: string;
  date: string;
  startHours: string;
  endHours: string;
  note: string;
  jobTag: string;
  photoPath: string | null;
  needsRepair: boolean;
}

export function saveDraft(draft: LogDraft): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private mode or a full store: the sheet still works, the form is
    // just empty when you come back.
  }
}

/** Read the draft and clear it, so it is only ever restored once. */
export function takeDraft(): LogDraft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as LogDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clean up
  }
}
