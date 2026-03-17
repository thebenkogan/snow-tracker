import { NextResponse } from "next/server";
import { fetchAllMenus } from "@/services/scraper";
import { STATIONS } from "@/constants/stations";

export async function GET() {
  try {
    const stations = await fetchAllMenus(STATIONS.map((s) => s.id));
    return NextResponse.json(stations);
  } catch (error) {
    console.error("Error fetching menus:", error);
    return NextResponse.json(
      { error: "Failed to fetch menus" },
      { status: 500 }
    );
  }
}
