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
  created_at: string;
  updated_at: string;
}

export interface EntryWithNames extends Entry {
  machines: { name: string } | null;
  crew: { name: string } | null;
}

export interface NewEntry {
  machine_id: string;
  crew_member_id: string;
  date: string;
  start_hours: number;
  end_hours: number | null;
  note: string | null;
  job_tag: string | null;
}
