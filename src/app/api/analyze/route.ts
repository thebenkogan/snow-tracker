import { NextRequest, NextResponse } from "next/server";
import { analyzeMealWithGemini } from "@/services/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, selectedDishes, notes } = body;

    if (!selectedDishes || !Array.isArray(selectedDishes)) {
      return NextResponse.json(
        { error: "Invalid request: selectedDishes is required" },
        { status: 400 }
      );
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Image is required for AI analysis" },
        { status: 400 }
      );
    }

    const macros = await analyzeMealWithGemini(imageBase64, selectedDishes, notes);

    return NextResponse.json(macros);
  } catch (error) {
    console.error("Error analyzing meal:", error);
    return NextResponse.json(
      { error: "Failed to analyze meal" },
      { status: 500 }
    );
  }
}
