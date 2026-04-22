import { CheckSquare } from "lucide-react";
import { Station, DayMenu } from "@/types";

interface MenuSelectProps {
  station: Station;
  currentMenu: DayMenu;
  selectedDishes: { stationId: string; name: string }[];
  onToggle: (stationId: string, dish: { name: string; ingredients: string[] }) => void;
  onContinue: () => void;
}

export default function MenuSelect({
  station,
  currentMenu,
  selectedDishes,
  onToggle,
  onContinue,
}: MenuSelectProps) {
  const isSelected = (dishName: string) =>
    selectedDishes.some(
      (d) => d.stationId === station.id && d.name === dishName,
    );

  const selectedCount = selectedDishes.filter(
    (d) => d.stationId === station.id,
  ).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-3 mb-4">
          {station.imageUrl && (
            <img
              src={station.imageUrl}
              alt={station.name}
              className="w-12 h-12 rounded object-contain bg-gray-50 p-1"
            />
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {station.name}
            </h2>
            <span className="text-gray-500 text-sm">{currentMenu.day}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentMenu.dishes.map((dish, idx) => {
            const selected = isSelected(dish.name);
            return (
              <button
                key={idx}
                onClick={() =>
                  onToggle(station.id, {
                    name: dish.name,
                    ingredients: dish.ingredients,
                  })
                }
                className={`p-3 rounded-lg text-left transition-all ${
                  selected
                    ? "bg-green-50 border-2 border-green-500"
                    : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selected
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300"
                    }`}
                  >
                    {selected && (
                      <CheckSquare className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{dish.name}</p>
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
              {new Set(selectedDishes.map((d) => d.stationId)).size} stations
            </span>
          </div>
          <button
            onClick={onContinue}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}