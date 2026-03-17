import { GoogleGenerativeAI } from "@google/generative-ai";
import { Macros } from "@/types";
import { generateMealPrompt } from "@/utils/meal";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function analyzeMealWithGemini(
  imageBase64: string,
  selectedDishes: Array<{ name: string; ingredients: string[] }>,
  notes?: string,
): Promise<Macros> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = generateMealPrompt(selectedDishes, notes);

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: "image/jpeg",
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        calories: Math.round(parsed.calories || 0),
        protein: Math.round(parsed.protein || 0),
        carbs: Math.round(parsed.carbs || 0),
        fat: Math.round(parsed.fat || 0),
      };
    }

    return defaultMacros();
  } catch (error) {
    console.error("Gemini API error:", error);
    return defaultMacros();
  }
}

function defaultMacros(): Macros {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
}
