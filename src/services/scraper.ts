import { Station, DayMenu, Dish } from "@/types";
import { STATION_IMAGES } from "@/utils/meal";

const BASE_URL = "https://eat.sifted.co/meals";

// Helper to decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function fetchAllMenus(stationIds: string[]): Promise<Station[]> {
  const stations: Station[] = [];

  for (const id of stationIds) {
    try {
      const station = await fetchMenu(id);
      if (station) {
        stations.push(station);
      }
    } catch (error) {
      console.error(`Failed to fetch menu for ${id}:`, error);
    }
  }

  return stations;
}

export async function fetchMenu(stationId: string): Promise<Station | null> {
  try {
    const response = await fetch(`${BASE_URL}/${stationId}`, {
      method: "GET",
      headers: {
        Accept: "text/html",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error("Failed to fetch menu:", response.status);
      return null;
    }

    const html = await response.text();
    return parseMenuHtml(html, stationId);
  } catch (error) {
    console.error("Error fetching menu:", error);
    return null;
  }
}

function parseMenuHtml(html: string, stationId: string): Station {
  // Extract station name from "Service for X" - capture multi-word names
  const stationNameMatch = html.match(/Service for\s+([^<]+)/);
  const stationName = stationNameMatch
    ? decodeHtmlEntities(stationNameMatch[1].trim())
    : `Station ${stationId.slice(0, 8)}`;

  // Use static image URL
  const imageUrl = STATION_IMAGES[stationId] || "";

  const menu: DayMenu[] = [];
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Find the menu-list section
  const menuListStart = html.indexOf('id="menu-list"');
  if (menuListStart === -1) {
    return { id: stationId, name: stationName, imageUrl, menu: [] };
  }

  const menuSection = html.slice(menuListStart);

  for (const dayName of dayNames) {
    // Find day in the menu list - pattern: <div id='Monday'>
    const dayIdPattern = new RegExp(`id='${dayName}'`, "i");
    const dayMatch = menuSection.match(dayIdPattern);

    if (!dayMatch) continue;

    // Get section around this day
    const dayStart = dayMatch.index!;
    const nextDayPattern = new RegExp(
      `id='(Monday|Tuesday|Wednesday|Thursday|Friday)'`,
      "i",
    );
    const nextDayMatch = menuSection.slice(dayStart + 10).match(nextDayPattern);

    let dayEnd = menuSection.length;
    if (nextDayMatch) {
      dayEnd = dayStart + 10 + nextDayMatch.index!;
    }

    const daySection = menuSection.slice(dayStart, dayEnd);

    // Extract date - in <p>Mar 16, 2026</p>
    const dateMatch = daySection.match(/<p[^>]*>Mar \d+, \d{4}<\/p>/);
    const date = dateMatch
      ? decodeHtmlEntities(dateMatch[0].replace(/<[^>]+>/g, "").trim())
      : "";

    // Find all dishes in this day section
    const dishes: Dish[] = [];

    // Find all h3 headings with dish names
    const dishRegex = /<h3[^>]*>([^<]+)<\/h3>/g;
    let dishMatch;

    while ((dishMatch = dishRegex.exec(daySection)) !== null) {
      const dishName = decodeHtmlEntities(dishMatch[1].trim());

      if (!dishName || dishName.length > 50) continue;

      // Get content after dish name until next h3 or h2 or end
      const afterDishStart = dishMatch.index! + dishMatch[0].length;
      
      // Find the next h3 or h2 tag
      const nextH3Index = daySection.indexOf("<h3", afterDishStart);
      const nextH2Index = daySection.indexOf("<h2", afterDishStart);
      
      let afterDishEnd = daySection.length;
      if (nextH3Index !== -1 && nextH3Index < afterDishEnd) afterDishEnd = nextH3Index;
      if (nextH2Index !== -1 && nextH2Index < afterDishEnd) afterDishEnd = nextH2Index;
      
      const afterDish = daySection.slice(afterDishStart, afterDishEnd);

      // Try multiple patterns to find ingredients
      let ingredientsText = "";

      // Pattern 1: <p class="text-xs text-slate-500">...</p>
      const p1 = afterDish.match(/<p[^>]*text-slate-500[^>]*>([^<]+)<\/p>/);
      if (p1) ingredientsText = p1[1];

      // Pattern 2: <p class="text-xs ...">...</p> (any text-xs)
      if (!ingredientsText) {
        const p2 = afterDish.match(
          /<p[^>]*class="[^"]*text-xs[^"]*"[^>]*>([^<]+)<\/p>/,
        );
        if (p2) ingredientsText = p2[1];
      }

      // Pattern 3: Just look for a <p> after the h3 that contains comma-separated text
      if (!ingredientsText) {
        const p3 = afterDish.match(/<p[^>]*>([a-z][^<]{10,})<\/p>/);
        if (p3) ingredientsText = p3[1];
      }

      let ingredients: string[] = [];
      const allergens: string[] = [];

      if (ingredientsText) {
        // Decode entities and split by comma
        ingredients = decodeHtmlEntities(ingredientsText)
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i.length > 0 && i.length < 40);

        // Check for allergen images in the section
        const allergenSection = afterDish.slice(0, 300);
        const allergenMatches = allergenSection.matchAll(/title="([^"]+)"/g);
        for (const a of allergenMatches) {
          if (!allergens.includes(a[1])) allergens.push(a[1]);
        }
      }

      dishes.push({ name: dishName, ingredients, allergens });
    }

    if (dishes.length > 0) {
      menu.push({
        day: dayName,
        date,
        dishes,
      });
    }
  }

  console.log("Parsed:", stationName, menu.length, "days with dishes");

  return {
    id: stationId,
    name: stationName,
    imageUrl,
    menu,
  };
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
