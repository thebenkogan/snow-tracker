export interface SelectedDish {
  stationId: string;
  stationName: string;
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

export const STATION_IMAGES: Record<string, string> = {
  "659a82e0-6f43-432e-acf9-af733a7e1ef6": "https://images.sifted-dev.co/brands/pure.svg",
  "cdc9288e-8e59-43d9-a69d-404b8a936039": "https://images.sifted-dev.co/brands/RotatingPlate.svg",
  "7b143ea2-0e69-4a54-95ff-e07383ee664d": "https://images.sifted-dev.co/brands/WoknTandoor.svg",
  "e9699fc9-3bc1-4d04-be64-68ae4865b39a": "https://images.sifted-dev.co/brands/SweetSpot.svg",
  "15b2a5bb-da9f-43a9-808e-ffeb47ca040a": "https://images.sifted-dev.co/brands/WrapCulture.svg",
};
