"use client";

import { useState, useEffect, useMemo } from "react";
import { Station, DayMenu } from "@/types";
import { Loader2 } from "lucide-react";
import { STATION_IMAGES } from "@/constants/stations";
import { getCafeteriaTodayStr } from "@/utils/date";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import MenuSelect from "@/components/MenuSelect";
import CaptureView from "@/components/CaptureView";

type View = "select" | "capture";

function pickDefaultMenu(station: Station, todayStr: string): DayMenu | null {
  if (station.menu.length === 0) return null;
  // Prefer today even when empty so the header never misleadingly shows
  // another day (e.g. Monday on a Thursday).
  return (
    station.menu.find((m) => m.dateStr === todayStr) ||
    station.menu.find((m) => m.day === weekdayNameInCafeteria()) ||
    [...station.menu].reverse().find((m) => m.dishes.length > 0) ||
    station.menu[station.menu.length - 1] ||
    null
  );
}

function weekdayNameInCafeteria(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
  }).format(new Date());
}

export default function Home() {
  const [view, setView] = useState<View>("select");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [selectedDishes, setSelectedDishes] = useState<
    { stationId: string; stationName: string; name: string; ingredients: string[] }[]
  >([]);

  const todayStr = useMemo(() => getCafeteriaTodayStr(), []);

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/scrape");
      if (!res.ok) {
        throw new Error(`Menu request failed (${res.status})`);
      }
      const data = await res.json();
      const list: Station[] = Array.isArray(data) ? data : data.stations || [];
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error("No station menus came back from the server.");
      }
      const stationsWithImages = list.map((s: Station) => ({
        ...s,
        imageUrl: s.imageUrl || STATION_IMAGES[s.id] || "",
      }));
      setStations(stationsWithImages);
      const first = stationsWithImages[0];
      setSelectedStationId(first.id);
      setSelectedDateStr(todayStr);
    } catch (error) {
      console.error("Error loading menus:", error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to load menus.",
      );
    } finally {
      setLoading(false);
    }
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
  const defaultMenu = selectedStation
    ? pickDefaultMenu(selectedStation, todayStr)
    : null;
  const effectiveDateStr =
    selectedDateStr || defaultMenu?.dateStr || todayStr;
  const currentMenu: DayMenu | null = selectedStation
    ? selectedStation.menu.find((m) => m.dateStr === effectiveDateStr) ||
      selectedStation.menu.find((m) => m.dateStr === todayStr) ||
      defaultMenu
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
        {loadError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-red-800 text-sm flex-1">
              Couldn&apos;t load menus: {loadError}
            </p>
            <button
              onClick={loadMenus}
              className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {stations.length === 0 && !loadError && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-700 font-medium">No station menus found.</p>
            <button
              onClick={loadMenus}
              className="mt-3 text-green-600 hover:text-green-700 text-sm"
            >
              Try reloading
            </button>
          </div>
        )}

        {stations.length > 0 && (
          <>
            <StationSelector
              stations={stations}
              selectedStationId={selectedStationId}
              selectedDishes={selectedDishes}
              onSelect={setSelectedStationId}
            />

            {selectedStation && selectedStation.menu.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {selectedStation.menu.map((m) => {
                  const isActive =
                    (m.dateStr || m.day) === (currentMenu?.dateStr || currentMenu?.day);
                  const isToday = m.dateStr === todayStr;
                  return (
                    <button
                      key={m.dateStr || m.day}
                      onClick={() =>
                        setSelectedDateStr(m.dateStr || m.day)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap border transition-colors ${
                        isActive
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {m.day.slice(0, 3)}
                      {isToday ? " •" : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {view === "select" && selectedStation && currentMenu && (
              <MenuSelect
                station={selectedStation}
                currentMenu={currentMenu}
                selectedDishes={selectedDishes}
                onToggle={toggleDish}
                onContinue={() => setView("capture")}
              />
            )}

            {view === "select" && selectedStation && !currentMenu && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-700 font-medium">
                  No menu available for {selectedStation.name} right now.
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Try another day or reload — the cafeteria feed may be
                  temporarily down.
                </p>
              </div>
            )}
          </>
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
