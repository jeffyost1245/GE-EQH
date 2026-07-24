import { getSupabase } from "./supabase";
import {
  CrewMember,
  Entry,
  EntryWithNames,
  Machine,
  NewEntry,
} from "./types";
import { dequeue, enqueue, newLocalId, pendingOps } from "./queue";

const ENTRY_COLUMNS =
  "*, machines(name), crew(name)";

// ---------- machines ----------

export async function listMachines(activeOnly = false): Promise<Machine[]> {
  let q = getSupabase().from("machines").select("*").order("name");
  if (activeOnly) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw error;
  return data as Machine[];
}

export async function addMachine(name: string): Promise<void> {
  const { error } = await getSupabase().from("machines").insert({ name });
  if (error) throw error;
}

export async function setMachineStatus(
  id: string,
  status: "active" | "inactive"
): Promise<void> {
  const { error } = await getSupabase()
    .from("machines")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

// ---------- crew ----------

export async function listCrew(activeOnly = false): Promise<CrewMember[]> {
  let q = getSupabase().from("crew").select("*").order("name");
  if (activeOnly) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw error;
  return data as CrewMember[];
}

export async function addCrewMember(name: string): Promise<void> {
  const { error } = await getSupabase().from("crew").insert({ name });
  if (error) throw error;
}

export async function setCrewStatus(
  id: string,
  status: "active" | "inactive"
): Promise<void> {
  const { error } = await getSupabase()
    .from("crew")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

// ---------- entries ----------

export async function latestEntryForMachine(
  machineId: string
): Promise<Entry | null> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select("*")
    .eq("machine_id", machineId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Entry) ?? null;
}

/**
 * Create an entry. If the machine's most recent existing entry was left
 * open (null end_hours), backfill that older entry's end_hours with this
 * entry's start_hours and mark it auto-filled.
 */
export async function createEntryOnline(entry: NewEntry): Promise<void> {
  const supabase = getSupabase();
  const prev = await latestEntryForMachine(entry.machine_id);

  const { error } = await supabase.from("entries").insert(entry);
  if (error) throw error;

  if (prev && prev.end_hours === null) {
    const { error: backfillError } = await supabase
      .from("entries")
      .update({
        end_hours: entry.start_hours,
        end_hours_autofilled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prev.id)
      .is("end_hours", null); // don't clobber if someone filled it meanwhile
    if (backfillError) throw backfillError;
  }
}

export async function updateEntryOnline(
  id: string,
  patch: Partial<NewEntry>
): Promise<void> {
  const { error } = await getSupabase()
    .from("entries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Save an entry, falling back to the offline queue when Supabase is
 * unreachable. Returns how the save landed.
 */
export async function saveEntry(
  entry: NewEntry
): Promise<"synced" | "queued"> {
  try {
    await createEntryOnline(entry);
    return "synced";
  } catch {
    enqueue({
      kind: "create",
      localId: newLocalId(),
      entry,
      queuedAt: new Date().toISOString(),
    });
    return "queued";
  }
}

export async function saveEntryUpdate(
  id: string,
  patch: Partial<NewEntry>
): Promise<"synced" | "queued"> {
  try {
    await updateEntryOnline(id, patch);
    return "synced";
  } catch {
    enqueue({
      kind: "update",
      localId: newLocalId(),
      entryId: id,
      patch,
      queuedAt: new Date().toISOString(),
    });
    return "queued";
  }
}

/**
 * Retry every queued op, oldest first. Ops are removed only after the
 * server accepts them. Queued creates run the same backfill logic as
 * live saves. Stops at the first failure (still offline).
 */
export async function syncPending(): Promise<number> {
  const ops = pendingOps();
  let synced = 0;
  for (const op of ops) {
    try {
      if (op.kind === "create") {
        await createEntryOnline(op.entry);
      } else {
        await updateEntryOnline(op.entryId, op.patch);
      }
      dequeue(op.localId);
      synced++;
    } catch {
      break;
    }
  }
  return synced;
}

export async function listEntries(limit = 100): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as EntryWithNames[];
}

export async function getEntry(id: string): Promise<EntryWithNames | null> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as EntryWithNames) ?? null;
}

export async function entriesForWeek(
  start: string,
  end: string
): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS)
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;
  return data as EntryWithNames[];
}
