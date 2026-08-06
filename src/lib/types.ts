export type Status = "active" | "inactive";

export interface Machine {
  id: string;
  name: string;
  status: Status;
  created_at: string;
  /** The company's three-character identifier, e.g. 925 or 871R. */
  unit_no?: string | null;
  make_model?: string | null;
  /** A key from MACHINE_TYPES. */
  machine_type?: string | null;
}

/** The identity fields, edited together on the machines screen. */
export interface MachineDetails {
  unit_no: string | null;
  make_model: string | null;
  machine_type: string | null;
}

export interface CrewMember {
  id: string;
  name: string;
  status: Status;
  created_at: string;
}

export interface Entry {
  id: string;
  machine_id: string;
  crew_member_id: string;
  date: string; // YYYY-MM-DD
  start_hours: number;
  end_hours: number | null;
  end_hours_autofilled: boolean;
  note: string | null;
  job_tag: string | null;
  /** Storage path of the checkout sheet photo, if one was attached. */
  photo_path: string | null;
  /** Flagged by the operator as needing a repair. */
  needs_repair: boolean;
  repair_done: boolean;
  repair_note: string | null;
  repair_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Role = "foreman" | "superintendent";

export interface Foreman {
  id: string;
  name: string;
  role: Role;
}

export interface ShareLink {
  id: string;
  foreman_id: string;
  week_start: string;
  week_end: string;
  created_at: string;
  expires_at: string;
}

export interface EntryWithNames extends Entry {
  machines: { name: string } | null;
  crew: { name: string } | null;
  /** Present on cross-crew queries so items can be labelled by crew. */
  foremen?: { name: string } | null;
}

// ---------- checkout sheet (inspection) ----------

/** N/A, OK, or RR (requires repair) — the paper's three columns. */
export type Mark = "na" | "ok" | "rr";

export interface ItemAnswer {
  mark: Mark;
  /** What's wrong. Only meaningful on an RR. */
  note?: string;
}

/** Keyed "section/item", e.g. "outside/Hoses". */
export type InspectionItems = Record<string, ItemAnswer>;

/** A finger-drawn signature, kept as strokes so it can be redrawn sharp. */
export interface Signature {
  w: number;
  h: number;
  strokes: [number, number][][];
}

export interface Inspection {
  id: string;
  machine_id: string;
  crew_member_id: string | null;
  date: string;
  location: string | null;
  shift: string | null;
  job_no: string | null;
  job_name: string | null;
  hour_meter: number | null;
  mileage: string | null;
  items: InspectionItems;
  defects: string | null;
  repairs_needed: boolean;
  signature: Signature | null;
  signed_at: string | null;
  repair_done: boolean;
  repair_note: string | null;
  repair_updated_at: string | null;
  corrected_at: string | null;
  correction_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionWithNames extends Inspection {
  machines: { name: string } | null;
  crew: { name: string } | null;
  foremen?: { name: string } | null;
}

export interface NewInspection {
  machine_id: string;
  crew_member_id: string | null;
  date: string;
  location: string | null;
  shift: string | null;
  job_no: string | null;
  job_name: string | null;
  hour_meter: number | null;
  mileage: string | null;
  items: InspectionItems;
  defects: string | null;
  repairs_needed: boolean;
  signature: Signature | null;
  signed_at: string | null;
}

export interface NewEntry {
  machine_id: string;
  crew_member_id: string;
  date: string;
  start_hours: number;
  end_hours: number | null;
  note: string | null;
  job_tag: string | null;
  photo_path?: string | null;
  needs_repair?: boolean;
}
