import { Station, DayMenu, Dish } from "@/types";
import { STATION_IMAGES, STATIONS } from "@/constants/stations";
import {
  formatDisplayDate,
  getCafeteriaTodayStr,
  getCafeteriaWeekDates,
} from "@/utils/date";
import { getCurrentDayMenu } from "@/utils/menu";

export { getCurrentDayMenu };

const BASE_URL = process.env.SIFTED_BASE_URL || "https://eat.sifted.co";
const REVALIDATE = 3600;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 500;
// A stalled upstream must not hang the route: bound every attempt.
const REQUEST_TIMEOUT_MS = 10_000;
// The Sifted API 502s under burst load, so keep parallelism low and
// only fetch the days the UI actually needs (today + walk-back).
const CONCURRENCY_LIMIT = 3;

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

/** Run async tasks with bounded parallelism, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * Fetch with retries for transient upstream failures (5xx/429) using
 * exponential backoff with jitter. Throws when retries are exhausted
 * (or on network errors) so callers can tell "upstream is down" apart
 * from "no food today". 4xx responses are returned as-is — a bad id or
 * date won't heal on retry.
 */
async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        next: { revalidate: REVALIDATE },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(
          RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250,
        );
      }
      continue;
    }
    if ((res.status >= 500 || res.status === 429) && attempt < retries) {
      lastError = new Error(`Sifted API request failed (${res.status})`);
      await delay(
        RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250,
      );
      continue;
    }
    if (res.status >= 500 || res.status === 429) {
      throw new Error(`Sifted API request failed (${res.status})`);
    }
    return res;
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export async function fetchAllMenus(stationIds: string[]): Promise<Station[]> {
  let failures = 0;
  const results = await mapWithConcurrency(
    stationIds,
    CONCURRENCY_LIMIT,
    async (id) => {
      try {
        return await fetchStationMenus(id);
      } catch (error) {
        failures++;
        console.error(`Failed to fetch menu for ${id}:`, error);
        return fallbackStation(id);
      }
    },
  );

  const stations = results.filter(
    (station): station is Station => station !== null,
  );
  // Every station failed: the upstream is down, not the cafeteria empty.
  // Throw so the route answers 500 (with a Retry button) instead of
  // serving — and caching — blank menus.
  if (stations.length === 0 || failures >= stationIds.length) {
    throw new Error("Failed to fetch menus: Sifted API is unavailable");
  }

  return stations;
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
  let name: string | null | undefined;
  try {
    name = await fetchStationName(stationId);
  } catch {
    name = null;
  }
  name = name || configName;
  if (!name) return null;

  const todayStr = getCafeteriaTodayStr();
  const week = getCafeteriaWeekDates();
  // Days from today backwards (Mon..today). The UI only shows today, so
  // fetch today first and only walk back while it comes back empty
  // (weekend/holiday/closed) — a failed today aborts so an outage
  // surfaces fast instead of burning retries on every weekday.
  const daysToCheck = week
    .filter(({ dateStr }) => dateStr <= todayStr)
    .reverse();

  const menus: DayMenu[] = [];
  for (const { dayName, dateStr } of daysToCheck) {
    const dishes = await fetchDishesForDate(stationId, dateStr);
    menus.push({
      day: dayName,
      date: formatDisplayDate(dateStr),
      dateStr,
      dishes,
    });
    // Stop at the first day with food; otherwise keep walking back so
    // weekends/holidays resolve to the most recent day with dishes.
    if (dishes.length > 0) break;
  }

  // Restore Mon–Fri order so day matching resolves correctly.
  menus.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return {
    id: stationId,
    name,
    imageUrl,
    menu: menus,
  };
}

async function fetchStationName(stationId: string): Promise<string | null> {
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
}

/**
 * Dishes for one date. Returns [] when the feed genuinely has no food
 * (or the id/date is bad). Throws when the upstream is failing so the
 * outage surfaces instead of being cached as an empty menu.
 */
async function fetchDishesForDate(
  stationId: string,
  dateStr: string,
): Promise<Dish[]> {
  const res = await fetchWithRetry(
    `${BASE_URL}/api/accounts/meals?id=${stationId}&date=${dateStr}`,
  );
  if (!res.ok) return [];
  let json: ApiResponse;
  try {
    json = await res.json();
  } catch {
    throw new Error("Sifted API returned a non-JSON response");
  }
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
}
