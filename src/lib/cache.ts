// Tiny localStorage cache so dropdowns and start-hours prefill still
// work when the job site has no signal.

export function cacheSet(key: string, value: unknown) {
  try {
    window.localStorage.setItem(`eqh_cache_${key}`, JSON.stringify(value));
  } catch {
    // storage full/unavailable — cache is best-effort
  }
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`eqh_cache_${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
