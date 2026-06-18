// All class schedule times/days in this app are stored as IST (Asia/Kolkata,
// a fixed UTC+5:30 with no DST). These helpers compute "now" / "today" in IST
// using the device's absolute clock (Date.now()) but reading the wall clock via
// getUTC*, so live/today/day-of-week logic is correct regardless of the device's
// own timezone. Use these instead of new Date().setHours / getDay / format(now).

const IST_OFFSET_MIN = 330;

/** A Date whose getUTC* fields represent the current IST wall clock. */
export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MIN * 60000);
}

/** Today's date in IST as 'yyyy-MM-dd'. */
export function istTodayStr(): string {
  return istNow().toISOString().slice(0, 10);
}

/** Current day of week in IST (0 = Sunday … 6 = Saturday). */
export function istDayOfWeek(): number {
  return istNow().getUTCDay();
}

/** Current time of day in IST as minutes since midnight. */
export function istMinutesNow(): number {
  const d = istNow();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Current time in IST as 'HH:mm:ss'. */
export function istTimeStr(): string {
  return istNow().toISOString().slice(11, 19);
}

/** Convert a 'HH:mm' or 'HH:mm:ss' string to minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Day of week (0–6) in IST for a given 'yyyy-MM-dd' date string. */
export function istDayOfWeekForDate(dateStr: string): number {
  // Interpret the date at IST midnight, then read the UTC day of that instant.
  return new Date(`${dateStr}T00:00:00+05:30`).getUTCDay();
}
