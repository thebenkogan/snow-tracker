"use client";

import { useState, useEffect } from "react";
import { Station, DayMenu } from "@/types";
import { Loader2 } from "lucide-react";
import { STATION_IMAGES } from "@/constants/stations";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import MenuSelect from "@/components/MenuSelect";
import CaptureView from "@/components/CaptureView";

type View = "select" | "capture";

export default function Home() {
  const [view, setView] = useState<View>("select");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [selectedDishes, setSelectedDishes] = useState<
    { stationId: string; stationName: string; name: string; ingredients: string[] }[]
  >([]);

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scrape");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const stationsWithImages = data.map((s: Station) => ({
          ...s,
          imageUrl: STATION_IMAGES[s.id] || "",
        }));
        setStations(stationsWithImages);
        setSelectedStationId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading menus:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDayMenu = (station: Station): DayMenu | null => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const today = days[new Date().getDay()];
    return station.menu.find((m) => m.day === today) || station.menu[0] || null;
  };

  const toggleDish = (
    stationId: string,
    dish: { name: string; ingredients: string[] },
  ) => {
    const station = stations.find((s) => s.id === stationId);
    const stationName = station?.name || "";
    setSelectedDishes((prev) => {
      const exists = prev.find(
        (d) => d.stationId === stationId && d.name === dish.name,
      );
      if (exists) {
        return prev.filter(
          (d) => !(d.stationId === stationId && d.name === dish.name),
        );
      }
      return [...prev, { stationId, stationName, ...dish }];
    });
  };

  const handleReset = () => {
    setSelectedDishes([]);
    setView("select");
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const currentMenu = selectedStation
    ? getCurrentDayMenu(selectedStation)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p className="text-gray-500">Loading menus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <StationSelector
          stations={stations}
          selectedStationId={selectedStationId}
          selectedDishes={selectedDishes}
          onSelect={setSelectedStationId}
        />

        {view === "select" && selectedStation && currentMenu && (
          <MenuSelect
            station={selectedStation}
            currentMenu={currentMenu}
            selectedDishes={selectedDishes}
            onToggle={toggleDish}
            onContinue={() => setView("capture")}
          />
        )}

        {view === "capture" && (
          <CaptureView
            selectedDishes={selectedDishes}
            stations={stations}
            onBack={() => setView("select")}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}