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
  
  let prompt = "Please analyze this meal and estimate nutritional macros.\n\n";
  prompt += "Dishes selected:\n";
  
  for (const [stationName, dishes] of Object.entries(byStation)) {
    prompt += `\n${stationName}:\n`;
    for (const dish of dishes) {
      prompt += `- ${dish.name}: ${dish.ingredients.join(", ")}\n`;
    }
  }
  
  if (notes && notes.trim()) {
    prompt += `\nNotes: ${notes.trim()}\n`;
  }
  
  prompt += "\nPlease provide: calories, protein (g), carbs (g), fat (g)";
  
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
