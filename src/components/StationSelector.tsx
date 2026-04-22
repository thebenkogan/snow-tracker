import { Station } from "@/types";

interface StationSelectorProps {
  stations: Station[];
  selectedStationId: string;
  selectedDishes: { stationId: string; name: string }[];
  onSelect: (stationId: string) => void;
}

export default function StationSelector({
  stations,
  selectedStationId,
  selectedDishes,
  onSelect,
}: StationSelectorProps) {
  return (
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
              onClick={() => onSelect(station.id)}
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
                    selectedDishes.filter((d) => d.stationId === station.id).length
                  }
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}