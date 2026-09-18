import { Station, DayMenu, Dish } from "@/types";
import { STATION_IMAGES, STATIONS } from "@/constants/stations";
import {
  formatDisplayDate,
  getCafeteriaTodayStr,
  getCafeteriaWeekDates,
} from "@/utils/date";

const BASE_URL = "https://eat.sifted.co";
const REVALIDATE = 3600;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;

interface ScheduledElement {
  id: string;
  name: string;
  tags: string[];
  type: string;
  allergens: string[];
  ingredients: string;
}

interface ApiMenu {
  id: string;
  name: string;
  description: string;
  date: string;
  brand: { name: string; img: string };
  serviceLine: { name: string; order: number };
  menuType: string;
  scheduledElements: ScheduledElement[];
}

interface ApiServiceLine {
  serviceLine: { name: string; order: number };
  menus: ApiMenu[];
}

interface ApiResponse {
  data: ApiServiceLine[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: REVALIDATE } });
      // Retry transient 5xx; 4xx (bad id/date) won't heal on retry.
      if (res.status >= 500 && attempt < retries) {
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await delay(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export async function fetchAllMenus(stationIds: string[]): Promise<Station[]> {
  const results = await Promise.all(
    stationIds.map(async (id) => {
      try {
        return await fetchStationMenus(id);
      } catch (error) {
        console.error(`Failed to fetch menu for ${id}:`, error);
        return fallbackStation(id);
      }
    }),
  );

  return results.filter((station): station is Station => station !== null);
}

function fallbackStation(stationId: string): Station | null {
  const config = STATIONS.find((s) => s.id === stationId);
  if (!config) return null;
  const week = getCafeteriaWeekDates();
  return {
    id: stationId,
    name: config.name,
    imageUrl: STATION_IMAGES[stationId] || "",
    menu: week.map(({ dayName, dateStr }) => ({
      day: dayName,
      date: formatDisplayDate(dateStr),
      dateStr,
      dishes: [],
    })),
  };
}

async function fetchStationMenus(stationId: string): Promise<Station | null> {
  const imageUrl = STATION_IMAGES[stationId] || "";
  // Never drop a known station just because the name lookup flaked —
  // fall back to the configured name so the station still renders
  // (possibly with empty menus) instead of vanishing entirely.
  const configName = STATIONS.find((s) => s.id === stationId)?.name;
  const name = (await fetchStationName(stationId)) || configName;
  if (!name) return null;

  const week = getCafeteriaWeekDates();

  const menuPromises = week.map(async ({ dayName, dateStr }) => {
    const dishes = await fetchDishesForDate(stationId, dateStr);
    // Keep every weekday, even when empty, so day matching on the
    // client resolves to the correct day instead of falling back to
    // Monday and so the UI can show an explicit empty state.
    const menu: DayMenu = {
      day: dayName,
      date: formatDisplayDate(dateStr),
      dateStr,
      dishes,
    };
    return menu;
  });

  const menu = await Promise.all(menuPromises);

  return {
    id: stationId,
    name,
    imageUrl,
    menu,
  };
}

async function fetchStationName(stationId: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/api/accounts/redirect-address?accountId=${stationId}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const entropy = json.data?.entropy;
    const slug = json.data?.slug;
    if (!entropy || !slug) return null;

    const acctRes = await fetchWithRetry(
      `${BASE_URL}/api/accounts/${encodeURIComponent(entropy)}/${encodeURIComponent(slug)}`,
    );
    if (!acctRes.ok) return null;
    const acctJson = await acctRes.json();
    return acctJson.data?.name || null;
  } catch {
    return null;
  }
}

async function fetchDishesForDate(
  stationId: string,
  dateStr: string,
): Promise<Dish[]> {
  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/api/accounts/meals?id=${stationId}&date=${dateStr}`,
    );
    if (!res.ok) return [];
    const json: ApiResponse = await res.json();
    if (!json.data) return [];

    const dishes: Dish[] = [];
    for (const serviceLine of json.data) {
      for (const menu of serviceLine.menus) {
        for (const element of menu.scheduledElements ?? []) {
          const ingredients = element.ingredients
            ? element.ingredients
                .split(",")
                .map((i) => i.trim())
                .filter((i) => i.length > 0)
            : [];

          dishes.push({
            name: element.name,
            ingredients,
            allergens: element.allergens ?? [],
          });
        }
      }
    }
    return dishes;
  } catch {
    return [];
  }
}

export function getCurrentDayMenu(
  station: Station,
  todayStr: string = getCafeteriaTodayStr(),
): DayMenu | null {
  if (station.menu.length === 0) return null;

  // Exact date match first — this is what keeps Thursday on Thursday
  // even when other days are empty.
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

  // Today isn't in this week's Mon–Fri (weekend/holiday): show the most
  // recent day with dishes rather than misleadingly jumping to Monday.
  const past = station.menu
    .filter((m) => m.dateStr <= todayStr && m.dishes.length > 0)
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  if (past.length > 0) return past[0];

  return (
    [...station.menu].reverse().find((m) => m.dishes.length > 0) || null
  );
}
