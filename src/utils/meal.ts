import { STATION_IMAGES } from "@/constants/stations";

export interface SelectedDish {
  stationId: string;
  stationName: string;
  stationImageUrl?: string;
  name: string;
  ingredients: string[];
}

export interface SimpleDish {
  name: string;
  ingredients: string[];
}

export function generateMealPrompt(
  selectedDishes: (SelectedDish | SimpleDish)[],
  notes?: string
): string {
  const byStation: Record<string, SimpleDish[]> = {};

  for (const dish of selectedDishes) {
    const stationName = "stationName" in dish ? dish.stationName : "Unknown";
    if (!byStation[stationName]) {
      byStation[stationName] = [];
    }
    byStation[stationName].push({ name: dish.name, ingredients: dish.ingredients });
  }

  // Candidate items, flattened. Deliberately framed as *candidates*: benchmarking showed
  // that presenting the selection as a definite list makes the model assume a full serving
  // of every item, inflating calories by ~50%. Saying "candidates" and stating that the
  // list carries no quantity information was worth ~15 points of median error.
  const candidates: string[] = [];
  const seenCandidate = new Set<string>();
  const addCandidate = (raw: string) => {
    const label = raw.trim();
    // Dish names frequently restate their own first ingredient ("Egg Noodles" +
    // "egg noodles"). Without this the model sees the same food twice and is more
    // likely to count it twice.
    const key = label.toLowerCase();
    if (!label || seenCandidate.has(key)) return;
    seenCandidate.add(key);
    candidates.push(label);
  };
  for (const dishes of Object.values(byStation)) {
    for (const dish of dishes) {
      addCandidate(dish.name);
      for (const ing of dish.ingredients) addCandidate(ing);
    }
  }

  let prompt = "Analyze this meal and estimate its macronutrients.\n\n";
  prompt += "The user selected these candidate items from the food-court stations:\n";
  prompt += candidates.map((c) => `- ${c}`).join("\n");
  prompt += "\n\nThat list tells you WHAT MIGHT BE present and NOTHING about quantity.\n\n";
  prompt += "Work in this order:\n";
  prompt += "1. Estimate the total weight of the food on the plate in GRAMS, using the ";
  prompt += "plate rim, cutlery or your hand as scale references. A full dinner plate is ";
  prompt += "roughly 400-500g of food including sauce.\n";
  prompt += "2. Decide how those grams divide across the items, favouring the ones you can ";
  prompt += "actually see. Partial portions are the norm; do not assign a full serving to ";
  prompt += "every listed item.\n";
  prompt += "3. Convert to macros, including invisible oil and sauce.\n";

  if (notes && notes.trim()) {
    prompt += `\nNotes: ${notes.trim()}\n`;
  }

  prompt += "\nProvide total_weight_g, calories, protein (g), carbs (g), fat (g).";

  return prompt;
}

export function formatSelectedDishesForDisplay(
  selectedDishes: SelectedDish[]
): { stationName: string; stationImageUrl: string; dishName: string }[] {
  return selectedDishes.map((d) => ({
    stationName: d.stationName,
    stationImageUrl: STATION_IMAGES[d.stationId] || "",
    dishName: d.name,
  }));
}
