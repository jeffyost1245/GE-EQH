// What kinds of iron are on a job site, in the order the superintendent
// wants to see them.
//
// Kept here rather than in the database: a yard adds a kind of
// attachment more often than anyone wants to run a migration, and this
// is the list the dispatch board groups by, so the order is part of the
// design rather than an accident of insertion.

export interface MachineType {
  /** Stored value. Never change one of these — old rows still hold it. */
  key: string;
  label: string;
  /**
   * Attachments have no hour meter. They are carried for stock-keeping —
   * what's on site and who has it — so they never appear where hours or
   * inspections are asked for, and "idle for six days" means nothing
   * about them.
   */
  attachment?: boolean;
}

export const MACHINE_TYPES: MachineType[] = [
  { key: "excavator", label: "Excavator" },
  { key: "loader", label: "Loader" },
  { key: "skid_steer", label: "Skid Steer" },
  { key: "dozer", label: "Dozer" },
  { key: "haul_truck", label: "Haul Truck" },
  { key: "bomag", label: "Bomag" },
  {
    key: "excavator_attachment",
    label: "Excavator bucket / compaction wheel",
    attachment: true,
  },
];

export function machineType(key: string | null): MachineType | null {
  if (!key) return null;
  return MACHINE_TYPES.find((t) => t.key === key) ?? null;
}

export function typeLabel(key: string | null): string {
  return machineType(key)?.label ?? "";
}

export function isAttachment(key: string | null): boolean {
  return machineType(key)?.attachment === true;
}

/**
 * Unit numbers are compared without case or spacing: 311r, 311R and
 * " 311R " all name the same machine, and a crew typing it in a hurry
 * should not create a second one.
 */
export function normalizeUnit(unit: string): string {
  return unit.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * How a machine reads in a list: "925 · Cat D5". Falls back to the plain
 * name until the number has been filled in, so nothing looks broken
 * during the changeover.
 */
export function machineLabel(machine: {
  name: string;
  unit_no?: string | null;
}): string {
  return machine.unit_no ? `${machine.unit_no} · ${machine.name}` : machine.name;
}
