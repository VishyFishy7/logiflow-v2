/**
 * Time. Storage is UTC milliseconds in an integer column (PRD §4.2); display
 * is the tenant's local zone via `Intl` (never `Date#getHours()`), so the code
 * stays DST-safe even though India has no DST (PRD §15).
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function parts(ms: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return {
    year: out.year ?? "1970",
    month: out.month ?? "01",
    day: out.day ?? "01",
    hour: out.hour === "24" ? "00" : (out.hour ?? "00"),
    minute: out.minute ?? "00",
  };
}

/** ISO calendar date in tenant-local time: `2026-09-13`. */
export function toLocalDateKey(ms: number, timeZone = DEFAULT_TIMEZONE): string {
  const p = parts(ms, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `13 Sep 2026`. */
export function formatDateIst(ms: number, timeZone = DEFAULT_TIMEZONE): string {
  const p = parts(ms, timeZone);
  return `${p.day} ${MONTHS_SHORT[Number(p.month) - 1]} ${p.year}`;
}

/** `13 Sep 2026, 14:35`. */
export function formatDateTimeIst(ms: number, timeZone = DEFAULT_TIMEZONE): string {
  const p = parts(ms, timeZone);
  return `${p.day} ${MONTHS_SHORT[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** `14:35`. */
export function formatTimeIst(ms: number, timeZone = DEFAULT_TIMEZONE): string {
  const p = parts(ms, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** `2026-09-13 14:35` — stable, sortable, used in CSV exports. */
export function formatDateTimeSql(ms: number, timeZone = DEFAULT_TIMEZONE): string {
  const p = parts(ms, timeZone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Audit/log row form: `HH:mm` for today, `13 Sep 14:35` otherwise. */
export function formatAuditTime(ms: number, now = Date.now(), timeZone = DEFAULT_TIMEZONE): string {
  if (toLocalDateKey(ms, timeZone) === toLocalDateKey(now, timeZone)) {
    return formatTimeIst(ms, timeZone);
  }
  const p = parts(ms, timeZone);
  return `${p.day} ${MONTHS_SHORT[Number(p.month) - 1]} ${p.hour}:${p.minute}`;
}

export function formatRelative(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
  if (abs < minute) return "just now";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDateIst(ms);
}

/** Whole days between two instants, ignoring clock time. */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / 86_400_000);
}

export function startOfLocalDay(ms: number, timeZone = DEFAULT_TIMEZONE): number {
  const p = parts(ms, timeZone);
  // Anchor at 18:30 UTC = 00:00 IST is not general; compute the offset instead.
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  const drift = asUtc - Math.floor(ms / 86_400_000) * 86_400_000;
  return ms - (ms % 86_400_000) - drift;
}

export function addDays(ms: number, days: number): number {
  return ms + days * 86_400_000;
}

/** Unix ms for "today at 09:00 tenant-local" — used by the cron-style jobs. */
export function todayAt(hour: number, minute = 0, now = Date.now(), timeZone = DEFAULT_TIMEZONE): number {
  const p = parts(now, timeZone);
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, minute);
  // The difference between the local wall clock and UTC is constant enough for
  // a fixed-offset zone; recompute once so a DST zone lands correctly.
  const offsetGuess = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - now;
  return local - offsetGuess;
}

export function isoDate(ms: number, timeZone = DEFAULT_TIMEZONE): string {
  return toLocalDateKey(ms, timeZone);
}
