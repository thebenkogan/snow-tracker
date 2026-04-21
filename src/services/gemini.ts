import {
  GoogleGenerativeAI,
  Part,
  Schema,
  SchemaType,
} from "@google/generative-ai";
import { Macros } from "@/types";
import { generateMealPrompt } from "@/utils/meal";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const systemInstruction = `You are a nutrional expert. You will be given a photo of a meal along with a list of 
ingredients and an optional note. The meal is from a work place food court with various stations. Each ingredient is 
grouped by the station it came from. Please respond in JSON format with the macronutrients of the meal, including
calories, protein, carbs, and fat.`;

const nutritionSchema = {
  description: "Nutrition breakdown",
  type: SchemaType.OBJECT as const,
  properties: {
    calories: {
      type: SchemaType.NUMBER,
      description: "Total calories in kcal",
    },
    fats: {
      type: SchemaType.NUMBER,
      description: "Total fats in grams",
    },
    carbs: {
      type: SchemaType.NUMBER,
      description: "Total carbohydrates in grams",
    },
    protein: {
      type: SchemaType.NUMBER,
      description: "Total protein in grams",
    },
    notes: {
      type: SchemaType.STRING,
      description:
        "Any additional information, assumptions made, or notes for the user",
    },
  } as Record<string, Schema>,
  required: ["calories", "fats", "carbs", "protein", "notes"],
};

interface RunResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}

async function runAnalysis(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  prompt: string,
  imagePart: Part,
): Promise<RunResult | null> {
  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    console.log("[GEMINI] Response:", response);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        calories: Math.round(parsed.calories || 0),
        protein: Math.round(parsed.protein || 0),
        carbs: Math.round(parsed.carbs || 0),
        fat: Math.round(parsed.fats || 0),
        notes: parsed.notes || "",
      };
    }
    return null;
  } catch (error) {
    console.error("Gemini API error:", error);
    return null;
  }
}

export async function analyzeMealWithGemini(
  imageBase64: string,
  selectedDishes: Array<{
    stationId: string;
    stationName: string;
    name: string;
    ingredients: string[];
  }>,
  notes?: string,
): Promise<Macros> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: nutritionSchema,
    },
  });

  const prompt = generateMealPrompt(selectedDishes, notes);

  const imagePart: Part = {
    inlineData: {
      data: imageBase64,
      mimeType: "image/jpeg",
    },
  };

  console.log("[GEMINI] Request:", {
    model: "gemini-2.5-flash",
    prompt,
    imageSize: `${Math.round(imageBase64.length / 1024)}KB`,
  });

  const results = await Promise.all([
    runAnalysis(model, prompt, imagePart),
    runAnalysis(model, prompt, imagePart),
    runAnalysis(model, prompt, imagePart),
  ]);

  const successfulRuns = results.filter((r): r is RunResult => r !== null);

  if (successfulRuns.length === 0) {
    return defaultMacros();
  }

  const avgCalories =
    successfulRuns.reduce((sum, r) => sum + r.calories, 0) /
    successfulRuns.length;
  const avgProtein =
    successfulRuns.reduce((sum, r) => sum + r.protein, 0) /
    successfulRuns.length;
  const avgCarbs =
    successfulRuns.reduce((sum, r) => sum + r.carbs, 0) / successfulRuns.length;
  const avgFat =
    successfulRuns.reduce((sum, r) => sum + r.fat, 0) / successfulRuns.length;

  return {
    calories: Math.round(avgCalories),
    protein: Math.round(avgProtein),
    carbs: Math.round(avgCarbs),
    fat: Math.round(avgFat),
    notes: successfulRuns.map((r) => r.notes).join("|||"),
    runCount: successfulRuns.length,
  };
}

function defaultMacros(): Macros {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    notes: "",
    runCount: 0,
  };
}
