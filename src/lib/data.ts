import { getSupabase } from "./supabase";
import {
  CrewMember,
  Entry,
  EntryWithNames,
  Foreman,
  Inspection,
  InspectionWithNames,
  Machine,
  MachineDetails,
  NewEntry,
  NewInspection,
  ShareLink,
} from "./types";
import { deleteSheetPhoto } from "./photo";
import { dequeue, enqueue, newLocalId, pendingOps } from "./queue";
import { requireCrewId } from "./tenant";

const ENTRY_COLUMNS =
  "*, machines(name, unit_no), crew(name)";

/** Cross-crew reads also carry the crew name, for labelling. */
const ENTRY_COLUMNS_WITH_CREW =
  "*, machines(name, unit_no), crew(name), foremen(name)";

// ---------- foremen ----------

/**
 * Names for the login dropdown. Goes through a database function rather
 * than a table read: the foremen table holds password hashes and is not
 * readable with the public key, and this returns only ids and names.
 */
export async function listForemen(): Promise<Foreman[]> {
  const { data, error } = await getSupabase().rpc("list_foremen");
  if (error) throw error;
  return (data ?? []) as Foreman[];
}

// ---------- machines ----------

/**
 * The machines this crew is holding. Read through crew_machines rather
 * than machines.foreman_id: a machine belongs to the company, and more
 * than one crew can have it on their list at the same time.
 */
export async function listMachines(activeOnly = false): Promise<Machine[]> {
  const { data, error } = await getSupabase()
    .from("crew_machines")
    .select("machine:machines(*)")
    .eq("foreman_id", requireCrewId());
  if (error) throw error;

  const machines = (data ?? [])
    .map((row) => (row as unknown as { machine: Machine }).machine)
    .filter((m): m is Machine => Boolean(m));

  return machines
    .filter((m) => !activeOnly || m.status === "active")
    .sort((a, b) => machineSortKey(a).localeCompare(machineSortKey(b)));
}

/** Unit number first where there is one, so lists read like the yard. */
function machineSortKey(machine: Machine): string {
  return `${machine.unit_no ?? "zzz"} ${machine.name}`;
}

/**
 * Find a machine anywhere in the company by its unit number. This is what
 * stops a second 311R being created when a crew is handed the first one.
 */
export async function findMachineByUnit(
  unit: string
): Promise<Machine | null> {
  const { data, error } = await getSupabase()
    .from("machines")
    .select("*")
    .ilike("unit_no", unit.trim())
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Machine) ?? null;
}

/** Put an existing company machine on this crew's list. */
export async function attachMachine(machineId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("crew_machines")
    .upsert(
      { foreman_id: requireCrewId(), machine_id: machineId },
      { onConflict: "foreman_id,machine_id" }
    );
  if (error) throw error;
}

/**
 * Take a machine off this crew's list. The machine and every hour ever
 * logged on it stay — this is handing it back, not scrapping it.
 */
export async function detachMachine(machineId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("crew_machines")
    .delete()
    .eq("foreman_id", requireCrewId())
    .eq("machine_id", machineId);
  if (error) throw error;
}

/** Which crews currently hold a machine. */
export async function crewsHolding(machineId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("crew_machines")
    .select("foremen(name)")
    .eq("machine_id", machineId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as unknown as { foremen?: { name: string } }).foremen?.name)
    .filter((name): name is string => Boolean(name));
}

/**
 * Put a machine the company has never seen into the fleet, and onto the
 * adding crew's list. foreman_id records who entered it, not who owns
 * it — the crew_machines row is what makes it show up in their dropdown.
 */
export async function addMachine(
  name: string,
  details?: Partial<MachineDetails>
): Promise<void> {
  const identity = Object.fromEntries(
    Object.entries(details ?? {}).filter(([, value]) => value)
  );
  const { data, error } = await getSupabase()
    .from("machines")
    .insert({ name, ...identity, foreman_id: requireCrewId() })
    .select("id")
    .limit(1);
  if (error) throw error;

  const created = (data?.[0] as { id: string } | undefined)?.id;
  if (created) await attachMachine(created);
}

/** Set the unit number, make/model and type on an existing machine. */
export async function setMachineDetails(
  id: string,
  details: MachineDetails
): Promise<void> {
  const { error } = await getSupabase()
    .from("machines")
    .update(details)
    .eq("id", id);
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

export async function renameMachine(id: string, name: string): Promise<void> {
  const { error } = await getSupabase()
    .from("machines")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

export async function machineEntryCount(id: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("machine_id", id);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Hard-delete a machine from the company fleet. Only safe when it has no
 * entries — history must never be orphaned — so callers check
 * machineEntryCount first and the foreign key is the backstop if they
 * don't. Foremen hand machines back instead; this is for cleaning up a
 * duplicate that was never used.
 */
export async function deleteMachine(id: string): Promise<void> {
  const { error } = await getSupabase().from("machines").delete().eq("id", id);
  if (error) throw error;
}

// ---------- crew ----------

export async function listCrew(activeOnly = false): Promise<CrewMember[]> {
  let q = getSupabase()
    .from("crew")
    .select("*")
    .eq("foreman_id", requireCrewId())
    .order("name");
  if (activeOnly) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw error;
  return data as CrewMember[];
}

export async function addCrewMember(name: string): Promise<void> {
  const { error } = await getSupabase()
    .from("crew")
    .insert({ name, foreman_id: requireCrewId() });
  if (error) throw error;
}

export async function setCrewStatus(
  id: string,
  status: "active" | "inactive"
): Promise<void> {
  const { error } = await getSupabase()
    .from("crew")
    .update({ status })
    .eq("foreman_id", requireCrewId())
    .eq("id", id);
  if (error) throw error;
}

export async function renameCrewMember(
  id: string,
  name: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("crew")
    .update({ name })
    .eq("foreman_id", requireCrewId())
    .eq("id", id);
  if (error) throw error;
}

export async function crewEntryCount(id: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("foreman_id", requireCrewId())
    .eq("crew_member_id", id);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Hard-delete a crew member. Only safe when they have no entries — their
 * logged hours must never be orphaned. Callers check crewEntryCount first.
 */
export async function deleteCrewMember(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("crew")
    .delete()
    .eq("foreman_id", requireCrewId())
    .eq("id", id);
  if (error) throw error;
}

// ---------- entries ----------

/**
 * The machine's most recent entry, from whichever crew logged it.
 *
 * Deliberately not scoped to the signed-in crew. There is one meter on
 * the machine, so there is one history: if Jake's crew ran it Tuesday and
 * Happy's crew takes it Wednesday, Happy starts from Jake's reading. The
 * crew name comes back so the screen can say whose reading it is rather
 * than a number appearing out of nowhere.
 */
export async function latestEntryForMachine(
  machineId: string
): Promise<EntryWithNames | null> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select("*, foremen(name)")
    .eq("machine_id", machineId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as EntryWithNames) ?? null;
}

/**
 * Drop photo_path when there's no photo. Without this, every write would
 * name the column, so entries would fail to save against a database that
 * hasn't had the checkout-sheet migration applied yet.
 */
function withoutEmptyPhoto<
  T extends { photo_path?: string | null; needs_repair?: boolean },
>(payload: T): T {
  let out = payload;
  if (!out.photo_path) {
    const { photo_path: _omitPhoto, ...rest } = out;
    out = rest as T;
  }
  if (!out.needs_repair) {
    const { needs_repair: _omitRepair, ...rest } = out;
    out = rest as T;
  }
  return out;
}

/**
 * Create an entry. If the machine's most recent existing entry was left
 * open (null end_hours), backfill that older entry's end_hours with this
 * entry's start_hours and mark it auto-filled.
 */
export async function createEntryOnline(entry: NewEntry): Promise<void> {
  const supabase = getSupabase();
  const prev = await latestEntryForMachine(entry.machine_id);

  const { error } = await supabase
    .from("entries")
    .insert({ ...withoutEmptyPhoto(entry), foreman_id: requireCrewId() });
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
      // Whoever left it open, this closes it — including another crew,
      // which is what a handover is. Still refuses to clobber a reading
      // somebody has since filled in.
      .is("end_hours", null);
    if (backfillError) throw backfillError;
  }
}

export async function updateEntryOnline(
  id: string,
  patch: Partial<NewEntry>
): Promise<void> {
  const { error } = await getSupabase()
    .from("entries")
    .update({
      ...withoutEmptyPhoto(patch),
      updated_at: new Date().toISOString(),
    })
    .eq("foreman_id", requireCrewId())
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
      } else if (op.kind === "inspection") {
        await saveInspectionOnline(op.inspection);
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
    .eq("foreman_id", requireCrewId())
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
    .eq("foreman_id", requireCrewId())
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as EntryWithNames) ?? null;
}

export async function entriesForWeek(
  start: string,
  end: string,
  /** Defaults to the signed-in crew; the share page passes the link's crew. */
  foremanId?: string
): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("foreman_id", foremanId ?? requireCrewId())
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;
  return data as EntryWithNames[];
}

// ---------- checkout sheet sharing ----------

/**
 * Attach (or clear) a checkout sheet photo on an existing entry. Kept
 * separate from saveEntryUpdate so a photo added right after saving
 * doesn't have to resend the whole entry.
 */
export async function setEntryPhoto(
  id: string,
  photoPath: string | null
): Promise<void> {
  const { error } = await getSupabase()
    .from("entries")
    .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
    .eq("foreman_id", requireCrewId())
    .eq("id", id);
  if (error) throw error;
}

/**
 * Mint a link that shows one week's checkout sheets without the crew
 * password, for forwarding to the safety officer.
 */
export async function createShareLink(
  weekStart: string,
  weekEnd: string,
  days = 30
): Promise<ShareLink> {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  const { data, error } = await getSupabase()
    .from("share_links")
    .insert({
      week_start: weekStart,
      week_end: weekEnd,
      expires_at: expires.toISOString(),
      foreman_id: requireCrewId(),
    })
    .select()
    .limit(1);
  if (error) throw error;
  return data![0] as ShareLink;
}

export async function getShareLink(token: string): Promise<ShareLink | null> {
  const { data, error } = await getSupabase()
    .from("share_links")
    .select("*")
    .eq("id", token)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as ShareLink) ?? null;
}


// ---------- checkout sheets (inspections) ----------

const INSPECTION_COLUMNS = "*, machines(name, unit_no), crew(name)";
const INSPECTION_COLUMNS_WITH_CREW = "*, machines(name, unit_no), crew(name), foremen(name)";

/**
 * Save a sheet. Upserts on machine and date because the paper works that
 * way — one checkout per machine per day — so a crew that opens the form
 * twice corrects the morning's sheet instead of filing a second one.
 */
export async function saveInspectionOnline(
  inspection: NewInspection
): Promise<Inspection> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .upsert(
      {
        ...inspection,
        foreman_id: requireCrewId(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "foreman_id,machine_id,date" }
    )
    .select()
    .limit(1);
  if (error) throw error;
  return data![0] as Inspection;
}

/** Save, falling back to the queue when there's no signal. */
export async function saveInspection(
  inspection: NewInspection
): Promise<{ status: "synced"; saved: Inspection } | { status: "queued" }> {
  try {
    return { status: "synced", saved: await saveInspectionOnline(inspection) };
  } catch {
    enqueue({
      kind: "inspection",
      localId: newLocalId(),
      inspection,
      queuedAt: new Date().toISOString(),
    });
    return { status: "queued" };
  }
}

export async function getInspection(
  id: string
): Promise<InspectionWithNames | null> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(INSPECTION_COLUMNS)
    .eq("foreman_id", requireCrewId())
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as InspectionWithNames) ?? null;
}

/** Today's sheet for a machine, if one has already been filled out. */
export async function inspectionForDay(
  machineId: string,
  date: string
): Promise<InspectionWithNames | null> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(INSPECTION_COLUMNS)
    .eq("foreman_id", requireCrewId())
    .eq("machine_id", machineId)
    .eq("date", date)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as InspectionWithNames) ?? null;
}

export async function inspectionsForWeek(
  start: string,
  end: string,
  foremanId?: string
): Promise<InspectionWithNames[]> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(INSPECTION_COLUMNS)
    .eq("foreman_id", foremanId ?? requireCrewId())
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });
  if (error) throw error;
  return data as InspectionWithNames[];
}

export async function listInspections(
  limit = 60
): Promise<InspectionWithNames[]> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(INSPECTION_COLUMNS)
    .eq("foreman_id", requireCrewId())
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as InspectionWithNames[];
}

/**
 * Location and job from the crew's most recent sheet that day, so the
 * second machine of the morning doesn't retype what the first one did.
 */
export async function todaysJobFields(
  date: string
): Promise<Pick<Inspection, "location" | "shift" | "job_no" | "job_name"> | null> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select("location, shift, job_no, job_name")
    .eq("foreman_id", requireCrewId())
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (
    (data?.[0] as Pick<
      Inspection,
      "location" | "shift" | "job_no" | "job_name"
    >) ?? null
  );
}

/**
 * Remove a checkout sheet. Scoped to the signed-in crew so one crew can
 * never delete another's, and hard rather than hidden: a sheet filed on
 * the wrong machine is clutter, and leaving a wrong safety record in
 * place because it's awkward to remove is worse than removing it.
 */
export async function deleteInspection(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("inspections")
    .delete()
    .eq("foreman_id", requireCrewId())
    .eq("id", id);
  if (error) throw error;
}

/**
 * Detach a photographed sheet from its entry and delete the image.
 *
 * The hours stay. A photo and the hours it was attached to are two
 * different records that happen to share a row — nobody asking to
 * remove a bad photo is asking to lose the day's hours with it.
 */
export async function removeEntryPhoto(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select("photo_path")
    .eq("foreman_id", requireCrewId())
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const path = (data?.[0] as { photo_path: string | null })?.photo_path;

  await setEntryPhoto(id, null);
  if (path) {
    try {
      await deleteSheetPhoto(path);
    } catch {
      // The entry no longer points at it; a stray object is harmless,
      // and failing here would leave the caller thinking nothing worked.
    }
  }
}

// ---------- maintenance (superintendent) ----------

/** Sheets with an open RR, across every crew. */
export async function allInspectionRepairs(
  done: boolean,
  limit = 200
): Promise<InspectionWithNames[]> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(INSPECTION_COLUMNS_WITH_CREW)
    .eq("repairs_needed", true)
    .eq("repair_done", done)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as InspectionWithNames[];
}

/** Close an inspection's repair, or reopen one that came back. */
export async function setInspectionRepairDone(
  id: string,
  done: boolean,
  note?: string | null
): Promise<void> {
  const patch: Record<string, unknown> = {
    repair_done: done,
    repair_updated_at: new Date().toISOString(),
  };
  if (note !== undefined) patch.repair_note = note;
  const { error } = await getSupabase()
    .from("inspections")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/** Recent sheets across every crew, for the superintendent. */
export async function allInspections(
  limit = 60
): Promise<InspectionWithNames[]> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(INSPECTION_COLUMNS_WITH_CREW)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as InspectionWithNames[];
}



/**
 * Repairs flagged across every crew. Deliberately unscoped: the
 * superintendent oversees all of them, and the middleware is what keeps
 * foremen off this path.
 */
export async function allRepairs(
  done: boolean,
  limit = 200
): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS_WITH_CREW)
    .eq("needs_repair", true)
    .eq("repair_done", done)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as EntryWithNames[];
}

/**
 * Entries whose note reads like a repair but was never flagged. Offered
 * as suggestions only — the wording is a guess, so nothing is treated as
 * a real item until someone confirms it.
 */
export async function repairSuggestions(
  limit = 300
): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS_WITH_CREW)
    .eq("needs_repair", false)
    .not("note", "is", null)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as EntryWithNames[]).filter((e) => looksLikeRepair(e.note));
}

/** Words crews actually use when something is wrong with a machine. */
const REPAIR_WORDS =
  /\b(leak|leaking|broke|broken|crack|cracked|repair|fix|fixed|replace|blown|blew|flat|overheat|smok|grind|noise|alarm|warning light|hydraulic|won'?t start|wont start|needs?\s|service|loose|worn|bent|damage)/i;

export function looksLikeRepair(note: string | null): boolean {
  return note != null && REPAIR_WORDS.test(note);
}

/** Promote a suggestion into a tracked repair. */
export async function flagRepair(entryId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("entries")
    .update({
      needs_repair: true,
      repair_done: false,
      repair_updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);
  if (error) throw error;
}

/** Close a repair, or reopen one that came back. */
export async function setRepairDone(
  entryId: string,
  done: boolean,
  note?: string | null
): Promise<void> {
  const patch: Record<string, unknown> = {
    repair_done: done,
    repair_updated_at: new Date().toISOString(),
  };
  if (note !== undefined) patch.repair_note = note;
  const { error } = await getSupabase()
    .from("entries")
    .update(patch)
    .eq("id", entryId);
  if (error) throw error;
}

/**
 * Who is holding what, company-wide. Machines no longer belong to a
 * crew, so the board has to ask the lists rather than the machine.
 */
export async function allMachineHolders(): Promise<Record<string, string[]>> {
  const { data, error } = await getSupabase()
    .from("crew_machines")
    .select("machine_id, foremen(name)");
  if (error) throw error;
  const held: Record<string, string[]> = {};
  for (const row of (data ?? []) as unknown as {
    machine_id: string;
    foremen?: { name: string } | null;
  }[]) {
    const name = row.foremen?.name;
    if (!name) continue;
    held[row.machine_id] = [...(held[row.machine_id] ?? []), name];
  }
  return held;
}

/** Every crew's machines, for the overview. */
/**
 * The whole company fleet.
 *
 * No foremen embed. crew_machines gives PostgREST a second path from
 * machines to foremen — the direct column and a many-to-many through the
 * join table — and it refuses a query it cannot disambiguate. It is also
 * the wrong question now: who holds a machine is allMachineHolders(),
 * and machines.foreman_id only records who first entered it.
 */
export async function allMachines(): Promise<Machine[]> {
  const { data, error } = await getSupabase()
    .from("machines")
    .select(
      "id, name, status, created_at, unit_no, machine_type"
    )
    .order("name");
  if (error) throw error;
  return data as Machine[];
}

/** Every crew's entries for a week, for the overview. */
export async function allEntriesForWeek(
  start: string,
  end: string
): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS_WITH_CREW)
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;
  return data as EntryWithNames[];
}

/**
 * Just enough of every crew's recent entries to work out what each
 * machine has been doing. Deliberately narrow — the dispatch board reads
 * the whole company at once, and it does not need note text or meter
 * readings to answer "has this been used lately".
 */
export async function fleetActivity(since: string): Promise<
  Pick<Entry, "machine_id" | "date" | "job_tag" | "needs_repair" | "repair_done">[]
> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select("machine_id, date, job_tag, needs_repair, repair_done")
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) throw error;
  return data as Pick<
    Entry,
    "machine_id" | "date" | "job_tag" | "needs_repair" | "repair_done"
  >[];
}

/** The same, for checkout sheets: where a machine was and what it needs. */
export async function fleetInspections(since: string): Promise<
  Pick<
    Inspection,
    | "machine_id"
    | "date"
    | "job_no"
    | "job_name"
    | "location"
    | "repairs_needed"
    | "repair_done"
  >[]
> {
  const { data, error } = await getSupabase()
    .from("inspections")
    .select(
      "machine_id, date, job_no, job_name, location, repairs_needed, repair_done"
    )
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) throw error;
  return data as Pick<
    Inspection,
    | "machine_id"
    | "date"
    | "job_no"
    | "job_name"
    | "location"
    | "repairs_needed"
    | "repair_done"
  >[];
}

/** Recent checkout sheets across every crew. */
export async function allSheets(limit = 60): Promise<EntryWithNames[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select(ENTRY_COLUMNS_WITH_CREW)
    .not("photo_path", "is", null)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as EntryWithNames[];
}
