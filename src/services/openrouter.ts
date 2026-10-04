import { Macros } from "@/types";
import { generateMealPrompt } from "@/utils/meal";
import { selectModels, aggregateTrials, maxTokensFor, Trial } from "./gemini-aggregation";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const systemInstruction = `You are a nutrition expert. You will be given a photo of a meal along with a list of
ingredients and an optional note. The meal is from a work place food court with various stations. Each ingredient is
grouped by the station it came from. Please respond in JSON format with the macronutrients of the meal, including
calories, protein, carbs, and fat.`;

/**
 * Plain JSON Schema. OpenRouter takes this directly via `response_format`, so there is no
 * need for the Gemini SDK's SchemaType enums.
 */
const nutritionSchema = {
  type: "object",
  properties: {
    total_weight_g: {
      type: "number",
      description:
        "Total estimated weight of all food on the plate in grams. Commit to this before the macros.",
    },
    calories: { type: "number", description: "Total calories in kcal" },
    fats: { type: "number", description: "Total fats in grams" },
    carbs: { type: "number", description: "Total carbohydrates in grams" },
    protein: { type: "number", description: "Total protein in grams" },
    notes: {
      type: "string",
      description: "Any additional information, assumptions made, or notes for the user",
    },
  },
  required: ["calories", "fats", "carbs", "protein", "total_weight_g", "notes"],
} as const;

/**
 * Retry transient upstream failures. Free and cheap models return 429/503 regularly, and a
 * dropped trial silently degrades the median.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1500,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const transient = /429|500|502|503|504|timeout|rate limit|overloaded|high demand/i.test(
        message,
      );
      if (!transient || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

/**
 * Single call, no deadline race. The 20s per-trial budget existed so one slow provider
 * could not stall a three-model ensemble; with one fast model (2.1s measured) it is dead
 * weight. Raise it if you ever put a slow model back into TRIAL_MODELS.
 */
const REQUEST_TIMEOUT_MS = 120_000;

async function runAnalysis(
  modelName: string,
  prompt: string,
  imageDataUrl: string,
): Promise<Trial | null> {
  const body = {
    model: modelName,
    messages: [
      { role: "system", content: systemInstruction },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "meal", schema: nutritionSchema },
    },
    temperature: 1,
    max_tokens: maxTokensFor(modelName),
  };

  console.log("[OPENROUTER] Request:", {
    model: modelName,
    imageKB: Math.round((imageDataUrl.length * 0.75) / 1024),
  });

  try {
    const result = await withRetry(() =>
      fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }).then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        return JSON.parse(text) as {
          choices?: { message?: { content?: string } }[];
        };
      }),
    );

    const content = result.choices?.[0]?.message?.content;
    if (!content) return null;

    console.log("[OPENROUTER] Response:", content.slice(0, 400));

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const rawWeight = parsed.total_weight_g;
    return {
      calories: Math.round(parsed.calories || 0),
      protein: Math.round(parsed.protein || 0),
      carbs: Math.round(parsed.carbs || 0),
      fat: Math.round(parsed.fats || 0),
      totalWeightG:
        typeof rawWeight === "number" && Number.isFinite(rawWeight) && rawWeight > 0
          ? Math.round(rawWeight)
          : null,
      notes: parsed.notes || "",
      modelUsed: modelName,
    };
  } catch (error) {
    console.error(`[OPENROUTER] ${modelName} failed:`, error);
    return null;
  }
}

export async function analyzeMeal(
  imageBase64: string,
  imageMimeType: string,
  selectedDishes: Array<{
    stationId: string;
    stationName: string;
    name: string;
    ingredients: string[];
  }>,
  notes?: string,
): Promise<Macros> {
  const prompt = generateMealPrompt(selectedDishes, notes);
  const mime = imageMimeType || "image/jpeg";
  const imageDataUrl = `data:${mime};base64,${imageBase64}`;

  const results = await Promise.all(
    selectModels().map((modelName) => runAnalysis(modelName, prompt, imageDataUrl)),
  );

  const successfulRuns = results.filter((r): r is Trial => r !== null);

  return aggregateTrials(successfulRuns);
}
