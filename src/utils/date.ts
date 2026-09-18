export const CAFETERIA_TZ = "America/Los_Angeles";

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

function getCafeteriaParts(
  now: Date = new Date(),
): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAFETERIA_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const weekdayStr = get("weekday");
  const weekday =
    { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
      weekdayStr
    ] ?? now.getDay();
  return { y, m, d, weekday };
}

export function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today's calendar date (YYYY-MM-DD) at the cafeteria, not the server. */
export function getCafeteriaTodayStr(now: Date = new Date()): string {
  const { y, m, d } = getCafeteriaParts(now);
  return toDateStr(y, m, d);
}

/**
 * Mon–Fri calendar dates (YYYY-MM-DD) for the cafeteria's current week.
 * Uses UTC-noon arithmetic so the result is independent of the server's
 * local timezone (e.g. Vercel runs on UTC, cafeteria is Pacific).
 */
export function getCafeteriaWeekDates(now: Date = new Date()): {
  dayName: string;
  dateStr: string;
}[] {
  const { y, m, d, weekday } = getCafeteriaParts(now);
  const mondayOffset = weekday === 0 ? -6 : weekday === 6 ? -5 : 1 - weekday;
  const mondayUtc = Date.UTC(y, m - 1, d + mondayOffset, 12);

  return WEEKDAY_NAMES.map((dayName, index) => {
    const t = new Date(mondayUtc + index * 86400000);
    return {
      dayName,
      dateStr: toDateStr(
        t.getUTCFullYear(),
        t.getUTCMonth() + 1,
        t.getUTCDate(),
      ),
    };
  });
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
