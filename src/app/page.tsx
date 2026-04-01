"use client";

import { useState, useEffect } from "react";
import { Station, DayMenu, Macros } from "@/types";
import {
  CheckSquare,
  Camera,
  Loader2,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import {
  generateMealPrompt,
  formatSelectedDishesForDisplay,
} from "@/utils/meal";
import { STATION_IMAGES } from "@/constants/stations";

type View = "select" | "capture";

export default function Home() {
  const [view, setView] = useState<View>("select");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [selectedDishes, setSelectedDishes] = useState<
    { stationId: string; name: string; ingredients: string[] }[]
  >([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");

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
    setSelectedDishes((prev) => {
      const exists = prev.find(
        (d) => d.stationId === stationId && d.name === dish.name,
      );
      if (exists) {
        return prev.filter(
          (d) => !(d.stationId === stationId && d.name === dish.name),
        );
      }
      return [...prev, { stationId, ...dish }];
    });
  };

  const isDishSelected = (stationId: string, dishName: string) => {
    return selectedDishes.some(
      (d) => d.stationId === stationId && d.name === dishName,
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        setImageBase64(base64);
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyDescription = () => {
    console.log("selectedDishes:", selectedDishes);
    const dishesWithNames = selectedDishes.map((d) => {
      const station = stations.find((s) => s.id === d.stationId);
      return {
        stationId: d.stationId,
        stationName: station?.name || "",
        name: d.name,
        ingredients: d.ingredients,
      };
    });
    const description = generateMealPrompt(dishesWithNames, notes);
    navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyze = async () => {
    if (selectedDishes.length === 0) return;
    if (!imageBase64) {
      alert("Please add a photo first");
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, selectedDishes, notes }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setMacros(data);
      }
    } catch (error) {
      console.error("Error analyzing:", error);
      alert("Failed to analyze meal");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedDishes([]);
    setImageUrl("");
    setImageBase64("");
    setMacros(null);
    setNotes("");
    setView("select");
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const currentMenu = selectedStation
    ? getCurrentDayMenu(selectedStation)
    : null;

  const getSelectedDishesForDisplay = () => {
    return formatSelectedDishesForDisplay(
      selectedDishes.map((d) => {
        const station = stations.find((s) => s.id === d.stationId);
        return {
          stationId: d.stationId,
          stationName: station?.name || "",
          name: d.name,
          ingredients: d.ingredients,
        };
      }),
    );
  };

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
      <header className="bg-green-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">SnowTracker</h1>
          <p className="text-green-200 text-sm">
            Count your Snowflake lunch macros
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
            {stations.map((station) => {
              const hasSelection = selectedDishes.some(
                (d) => d.stationId === station.id,
              );
              const isSelected = selectedStationId === station.id;

              return (
                <button
                  key={station.id}
                  onClick={() => setSelectedStationId(station.id)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-full whitespace-nowrap transition-colors text-xs sm:text-sm shrink-0 ${
                    isSelected
                      ? "bg-green-600 text-white"
                      : hasSelection
                        ? "bg-green-100 text-green-800 border border-green-300"
                        : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  {station.imageUrl && (
                    <img
                      src={station.imageUrl}
                      alt={station.name}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded object-contain bg-white"
                    />
                  )}
                  <span className="font-medium">{station.name}</span>
                  {hasSelection && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-white text-green-600"
                          : "bg-green-500 text-white"
                      }`}
                    >
                      {
                        selectedDishes.filter((d) => d.stationId === station.id)
                          .length
                      }
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {view === "select" && selectedStation && currentMenu && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3 mb-4">
                {selectedStation.imageUrl && (
                  <img
                    src={selectedStation.imageUrl}
                    alt={selectedStation.name}
                    className="w-12 h-12 rounded object-contain bg-gray-50 p-1"
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {selectedStation.name}
                  </h2>
                  <span className="text-gray-500 text-sm">
                    {currentMenu.day}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentMenu.dishes.map((dish, idx) => {
                  const isSelected = isDishSelected(
                    selectedStation.id,
                    dish.name,
                  );
                  return (
                    <button
                      key={idx}
                      onClick={() =>
                        toggleDish(selectedStation.id, {
                          name: dish.name,
                          ingredients: dish.ingredients,
                        })
                      }
                      className={`p-3 rounded-lg text-left transition-all ${
                        isSelected
                          ? "bg-green-50 border-2 border-green-500"
                          : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <CheckSquare className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {dish.name}
                          </p>
                          <p className="text-gray-500 text-xs line-clamp-1">
                            {dish.ingredients.join(", ")}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDishes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="bg-green-50 rounded-lg px-4 py-2">
                  <span className="text-green-800 font-medium">
                    {selectedDishes.length} selected across{" "}
                    {new Set(selectedDishes.map((d) => d.stationId)).size}{" "}
                    stations
                  </span>
                </div>
                <button
                  onClick={() => setView("capture")}
                  className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {view === "capture" && (
          <div className="space-y-6">
            <button
              onClick={() => setView("select")}
              className="text-green-600 hover:text-green-700 text-sm"
            >
              ← Back to selection
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Take a photo of your plate
                </h3>

                {imageUrl ? (
                  <div className="space-y-3">
                    <img
                      src={imageUrl}
                      alt="Meal"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <label className="block text-center text-sm text-green-600 cursor-pointer hover:text-green-700">
                      Change photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 flex items-center justify-center">
                    <div className="text-center">
                      <Camera className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">Click to add photo</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Your selection
                  </h3>
                  <div className="space-y-2">
                    {getSelectedDishesForDisplay().map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {item.stationImageUrl && (
                          <img
                            src={item.stationImageUrl}
                            alt=""
                            className="w-4 h-4 rounded object-contain"
                          />
                        )}
                        <span className="text-green-700 text-sm">
                          {item.stationName}: {item.dishName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <label className="font-semibold text-gray-800 mb-2 block">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g., didn't eat the rice, extra sauce, etc."
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleCopyDescription}
                  className="w-full py-3 rounded-lg font-medium bg-gray-800 text-white hover:bg-gray-900 flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? "Copied!" : "Copy Prompt for Gemini"}
                </button>

                {macros ? (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-bold text-green-800 mb-3">
                      Estimated Macros
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">
                          {macros.calories}
                        </p>
                        <p className="text-xs text-gray-500">Calories</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">
                          {macros.protein}g
                        </p>
                        <p className="text-xs text-gray-500">Protein</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">
                          {macros.carbs}g
                        </p>
                        <p className="text-xs text-gray-500">Carbs</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">
                          {macros.fat}g
                        </p>
                        <p className="text-xs text-gray-500">Fat</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleAnalyze}
                    disabled={true}
                    className="w-full py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white cursor-not-allowed opacity-80"
                  >
                    AI Analysis Coming Soon!
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="w-full py-3 text-gray-500 hover:text-gray-700"
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
