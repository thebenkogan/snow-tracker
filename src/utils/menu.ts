import type { Station, DayMenu } from "@/types";
import { getCafeteriaTodayStr } from "@/utils/date";

/**
 * Resolve which menu to show for "today".
 *
 * Exact date match first — this is what keeps Thursday on Thursday
 * even when other days are empty. On weekends/holidays (today not in
 * the Mon–Fri feed) it falls back to the most recent day with dishes
 * rather than misleadingly jumping to Monday.
 */
export function getCurrentDayMenu(
  station: Station,
  todayStr: string = getCafeteriaTodayStr(),
): DayMenu | null {
  if (station.menu.length === 0) return null;

  const today = station.menu.find((m) => m.dateStr === todayStr);
  if (today) return today;

  // Legacy payloads without dateStr: match by weekday name.
  if (!station.menu.some((m) => m.dateStr)) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "long",
    }).format(new Date());
    return (
      station.menu.find((m) => m.day === weekday) ||
      [...station.menu].reverse().find((m) => m.dishes.length > 0) ||
      null
    );
  }

  const past = station.menu
    .filter((m) => m.dateStr <= todayStr && m.dishes.length > 0)
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  if (past.length > 0) return past[0];

  return (
    [...station.menu].reverse().find((m) => m.dishes.length > 0) || null
  );
}
