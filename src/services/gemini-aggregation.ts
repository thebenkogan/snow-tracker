import type { FieldSpread, Macros } from "@/types";

/**
 * Aggregation and model-selection logic for meal analysis, kept free of Gemini imports so it
 * can be unit-tested without an API key.
 */

/**
 * One trial, one model.
 *
 * We tested a three-family ensemble (Qwen Omni + Llama 4 Scout + Gemini Flash-Lite) and it
 * was WORSE than the best single model: 28.3% vs 22.0% median error. The reason is visible
 * in the error correlations — r=0.81 to 0.86 between them. Different vendors, same failure
 * mode: they all anchor to a "typical meal" prior and overestimate together. Averaging
 * correlated errors does not cancel them.
 *
 * Gemini 3.1 Flash-Lite on 60 held-out labeled meals: 17.2% median calorie error, 2.1s,
 * $0.00088/capture. Better and ~14x faster than the alternatives, so one model it is.
 *
 * A global bias multiplier was also tested and REJECTED: a 0.76 value derived from 12 images
 * made held-out error worse (17.2% -> 30.1%), because those 12 happened to be high-bias
 * noise. See scripts/validate-multiplier.py.
 *
 * Known remaining weakness: it underestimates large meals by ~23% (small +1.7%, medium -4%,
 * large -23.2% bias by portion-size tercile). A size-dependent correction may help, but it
 * needs more ground truth than we have.
 */
export const TRIAL_MODELS = ["google/gemini-3.1-flash-lite"];

/**
 * Ling reasons before answering, so it needs a larger token budget than the others.
 * Without this it returns an empty completion. Kept for future candidates.
 */
export const MAX_TOKENS_FOR: Record<string, number> = {
  "inclusionai/ling-3.0-flash-vl": 2500,
};

export const DEFAULT_MAX_TOKENS = 900;

export const NUM_TRIALS = TRIAL_MODELS.length;

export function selectModels(count: number = NUM_TRIALS): string[] {
  return Array.from({ length: count }, (_, i) => TRIAL_MODELS[i % TRIAL_MODELS.length]);
}

export function maxTokensFor(model: string): number {
  return MAX_TOKENS_FOR[model] ?? DEFAULT_MAX_TOKENS;
}

/**
 * Calories implied by the macros. Averaging calories independently of the macros produced
 * displays where the headline number contradicted the macros beside it (median 26 kcal gap,
 * up to 141 in benchmarking). Deriving it keeps the four fields consistent.
 */
export function caloriesFromMacros(m: {
  protein: number;
  carbs: number;
  fat: number;
}): number {
  return 4 * m.protein + 4 * m.carbs + 9 * m.fat;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface Trial {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  totalWeightG: number | null;
  notes: string;
  modelUsed: string;
}

/**
 * Collapse trials into one answer: median per macro field, calories derived from those
 * medians, and the cross-trial spread kept as an explicit confidence signal.
 */
export function aggregateTrials(successfulRuns: Trial[]): Macros {
  if (successfulRuns.length === 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      notes: [],
      runCount: 0,
    };
  }

  const weights = successfulRuns
    .map((r) => r.totalWeightG)
    .filter((w): w is number => w !== null);

  const medProtein = median(successfulRuns.map((r) => r.protein));
  const medCarbs = median(successfulRuns.map((r) => r.carbs));
  const medFat = median(successfulRuns.map((r) => r.fat));
  const medCalories = caloriesFromMacros({
    protein: medProtein,
    carbs: medCarbs,
    fat: medFat,
  });

  const notes = successfulRuns.map((r) => ({
    note: r.notes,
    modelUsed: r.modelUsed,
  }));

  const base: Macros = {
    calories: Math.round(medCalories),
    protein: Math.round(medProtein),
    carbs: Math.round(medCarbs),
    fat: Math.round(medFat),
    totalWeightG: weights.length > 0 ? Math.round(median(weights)) : undefined,
    notes,
    runCount: successfulRuns.length,
  };

  // Spread and low-confidence only mean something when trials can disagree. With one model
  // there is nothing to measure, so we omit them rather than report a meaningless 0.
  if (successfulRuns.length < 2) return base;

  const calorieValues = successfulRuns.map((r) => r.calories);
  const calorieSpread = Math.max(...calorieValues) - Math.min(...calorieValues);
  const weightSpread =
    weights.length > 1 ? Math.max(...weights) - Math.min(...weights) : null;

  return {
    ...base,
    spread: { calories: Math.round(calorieSpread), weight: weightSpread },
    // Wide relative disagreement means the median is still a guess, not an answer.
    lowConfidence: calorieSpread / Math.max(medCalories, 1) > 0.4,
  };
}

export type { FieldSpread };
