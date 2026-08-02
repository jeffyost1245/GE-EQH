// Week runs Monday through Sunday, in the device's local timezone.

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export interface WeekRange {
  start: string;
  end: string;
}

/**
 * The Monday–Sunday week containing `from` (today by default), shifted by
 * `offset` weeks. Offset 0 is the current week, -1 the previous one.
 */
export function weekRange(offset = 0, from = new Date()): WeekRange {
  const dow = from.getDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  const monday = new Date(from);
  monday.setDate(from.getDate() - sinceMonday + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateString(monday), end: toDateString(sunday) };
}

export function currentWeekRange(): WeekRange {
  return weekRange(0);
}

/** "This week", "Last week", or the dates, for the header. */
export function weekLabel(offset: number, range: WeekRange): string {
  if (offset === 0) return "This Week";
  if (offset === -1) return "Last Week";
  if (offset === 1) return "Next Week";
  return `${formatShort(range.start)} – ${formatShort(range.end)}`;
}

function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Weekday + date, e.g. "Mon · Jul 27". */
export function formatDayHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.toLocaleDateString(undefined, {
    weekday: "short",
  })} · ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatHours(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}
