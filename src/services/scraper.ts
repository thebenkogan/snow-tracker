import { Station, DayMenu, Dish } from "@/types";
import { STATION_IMAGES } from "@/constants/stations";

const BASE_URL = "https://eat.sifted.co";

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

export async function fetchAllMenus(stationIds: string[]): Promise<Station[]> {
  const results = await Promise.all(
    stationIds.map(async (id) => {
      try {
        return await fetchStationMenus(id);
      } catch (error) {
        console.error(`Failed to fetch menu for ${id}:`, error);
        return null;
      }
    })
  );

  return results.filter((station): station is Station => station !== null);
}

async function fetchStationMenus(stationId: string): Promise<Station | null> {
  const imageUrl = STATION_IMAGES[stationId] || "";
  const name = await fetchStationName(stationId);
  if (!name) return null;

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const menuPromises = dayNames.map(async (dayName, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateStr = date.toISOString().split("T")[0];
    const dishes = await fetchDishesForDate(stationId, dateStr);
    if (dishes.length === 0) return null;
    return {
      day: dayName,
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      dishes,
    };
  });

  const menuResults = await Promise.all(menuPromises);
  const menu = menuResults.filter(
    (m): m is DayMenu => m !== null
  );

  return {
    id: stationId,
    name,
    imageUrl,
    menu,
  };
}

async function fetchStationName(stationId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/accounts/redirect-address?accountId=${stationId}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const entropy = json.data?.entropy;
    const slug = json.data?.slug;
    if (!entropy || !slug) return null;

    const acctRes = await fetch(
      `${BASE_URL}/api/accounts/${encodeURIComponent(entropy)}/${encodeURIComponent(slug)}`
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
  dateStr: string
): Promise<Dish[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/accounts/meals?id=${stationId}&date=${dateStr}`
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

export function getCurrentDayMenu(station: Station): DayMenu | null {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = days[new Date().getDay()];

  return station.menu.find((m) => m.day === today) || station.menu[0] || null;
}
