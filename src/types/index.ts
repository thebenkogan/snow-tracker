export interface Dish {
  name: string;
  ingredients: string[];
  allergens: string[];
}

export interface DayMenu {
  day: string;
  date: string;
  dateStr: string;
  dishes: Dish[];
}

export interface Station {
  id: string;
  name: string;
  imageUrl: string;
  menu: DayMenu[];
}

export interface MealLog {
  id: string;
  date: string;
  stationId: string;
  stationName: string;
  selectedDishes: string[];
  selectedIngredients: string[];
  imageUrl: string;
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  createdAt: string;
}

export interface NoteEntry {
  note: string;
  modelUsed: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * Model's estimate of total food weight in grams. The prompt makes the model commit to
   * this BEFORE any macros, which measurably reduces calorie inflation. It is a sanity
   * handle for the user, not just a display field: if this looks wrong, the macros are wrong.
   */
  totalWeightG?: number;
  notes: NoteEntry[];
  runCount: number;
  /** Spread across trials, as a confidence signal. Undefined for a single-model setup. */
  spread?: FieldSpread;
  /** Wide disagreement between trials. Undefined for a single-model setup. */
  lowConfidence?: boolean;
}

/**
 * Trial disagreement across runs. Meaningful only when TRIAL_MODELS has more than one
 * entry — with a single model there is nothing to disagree with, so these stay undefined.
 */
export interface FieldSpread {
  calories: number;
  weight: number | null;
}

/** kcal per 100g implied by the model's own numbers. Food-specific sanity band. */
export function impliedDensity(
  macros: Pick<Macros, "calories" | "totalWeightG">,
): number | null {
  if (!macros.totalWeightG || macros.totalWeightG <= 0) return null;
  return (macros.calories / macros.totalWeightG) * 100;
}

/**
 * Plausible kcal/100g for a mixed prepared meal. Most mixed dishes sit 100-250.
 * Outside this band the portion estimate or the macros are probably wrong.
 */
export const DENSITY_RANGE = { min: 80, max: 300 };

export function densityFlag(macros: Pick<Macros, "calories" | "totalWeightG">): string | null {
  const d = impliedDensity(macros);
  if (d === null) return null;
  if (d > DENSITY_RANGE.max) {
    return `Implausibly dense (${Math.round(d)} kcal/100g) — portion size or macros likely overestimated`;
  }
  if (d < DENSITY_RANGE.min) {
    return `Implausibly light (${Math.round(d)} kcal/100g) — portion size likely underestimated`;
  }
  return null;
}
