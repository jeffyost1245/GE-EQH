export type Status = "active" | "inactive";

export interface Machine {
  id: string;
  name: string;
  status: Status;
  created_at: string;
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
