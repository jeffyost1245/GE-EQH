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

export function currentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - sinceMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateString(monday), end: toDateString(sunday) };
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
