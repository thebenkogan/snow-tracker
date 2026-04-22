import { useState, useMemo } from "react";
import {
  Camera,
  Loader2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Station, Macros, NoteEntry } from "@/types";
import { generateMealPrompt, formatSelectedDishesForDisplay } from "@/utils/meal";

interface SelectedDish {
  stationId: string;
  stationName: string;
  name: string;
  ingredients: string[];
}

interface CaptureViewProps {
  selectedDishes: SelectedDish[];
  stations: Station[];
  onBack: () => void;
  onReset: () => void;
}

export default function CaptureView({
  selectedDishes,
  stations,
  onBack,
  onReset,
}: CaptureViewProps) {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingVerb, setAnalyzingVerb] = useState("Analyzing");
  const [macros, setMacros] = useState<Macros | null>(null);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [noteIndex, setNoteIndex] = useState(0);
  const [analysisFailed, setAnalysisFailed] = useState(false);

  const verbs = useMemo(
    () => [
      "Analyzing",
      "Crunching numbers",
      "Counting carbs",
      "Measuring protein",
      "Calculating calories",
      "Scanning ingredients",
      "Computing macros",
      "Evaluating nutrition",
      "Assessing portions",
      "Processing meal",
    ],
    [],
  );

  useMemo(() => {
    if (!analyzing) {
      setAnalyzingVerb("Analyzing");
      return;
    }
    const interval = setInterval(() => {
      setAnalyzingVerb(verbs[Math.floor(Math.random() * verbs.length)]);
    }, 1500);
    return () => clearInterval(interval);
  }, [analyzing, verbs]);

  const compressImage = (
    dataUrl: string,
    maxDim = 1024,
    quality = 0.8,
  ): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/jpeg", quality);
        const base64 = compressed.split(",")[1];
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.src = dataUrl;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        const { base64, mimeType } = await compressImage(result);
        setImageBase64(base64);
        setImageMimeType(mimeType);
        setImageUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyDescription = () => {
    const description = generateMealPrompt(selectedDishes, notes);
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
    setAnalysisFailed(false);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          imageMimeType,
          selectedDishes,
          notes,
        }),
      });

      const data = await res.json();
      if (data.error || data.runCount === 0) {
        setAnalysisFailed(true);
      } else {
        setMacros(data);
      }
    } catch (error) {
      console.error("Error analyzing:", error);
      setAnalysisFailed(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const getStationImageUrl = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    return station?.imageUrl || "";
  };

  const selectedDishesWithImages = formatSelectedDishesForDisplay(
    selectedDishes.map((d) => ({
      ...d,
      stationImageUrl: getStationImageUrl(d.stationId),
    })),
  );

  const parsedNotes = macros?.notes || [];
  const noteCount = parsedNotes.length;
  const currentParsedNote = noteCount > 0 ? parsedNotes[noteIndex] : null;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-green-600 hover:text-green-700 text-sm">
        ← Back to selection
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Take a photo of your plate</h3>

          {imageUrl ? (
            <div className="space-y-3">
              <img
                src={imageUrl}
                alt="Meal"
                className="w-full max-h-96 object-contain rounded-lg"
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
            <h3 className="font-semibold text-gray-800 mb-2">Your selection</h3>
            <div className="space-y-2">
              {selectedDishesWithImages.map((item, idx) => (
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
            className="w-full py-3 rounded-lg font-medium bg-gray-800 text-white hover:bg-gray-900 flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Prompt for Gemini"}
          </button>

          {macros ? (
            <MacrosDisplay
              macros={macros}
              parsedNotes={parsedNotes}
              noteIndex={noteIndex}
              setNoteIndex={setNoteIndex}
              currentParsedNote={currentParsedNote}
            />
          ) : analyzing ? (
            <div className="w-full py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {analyzingVerb}...
            </div>
          ) : analysisFailed ? (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800 font-medium">
                  Analysis failed. Please try again.
                </p>
              </div>
              <button
                onClick={handleAnalyze}
                className="w-full py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : (
            <button
              onClick={handleAnalyze}
              className="w-full py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 cursor-pointer"
            >
              AI Analysis
            </button>
          )}

          <button
            onClick={onReset}
            className="w-full py-3 text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

function MacrosDisplay({
  macros,
  parsedNotes,
  noteIndex,
  setNoteIndex,
  currentParsedNote,
}: {
  macros: Macros;
  parsedNotes: NoteEntry[];
  noteIndex: number;
  setNoteIndex: React.Dispatch<React.SetStateAction<number>>;
  currentParsedNote: NoteEntry | null;
}) {
  const noteCount = parsedNotes.length;

  return (
    <div className="bg-green-50 rounded-lg p-4">
      <h3 className="font-bold text-green-800 mb-3">
        Estimated Macros
        <span className="text-xs font-normal text-green-600 ml-2">
          (avg of {macros.runCount} runs)
        </span>
      </h3>
      {parsedNotes.length > 0 && (
        <p className="text-xs text-green-700 mb-2">
          Models: {parsedNotes.map((n) => n.modelUsed).join(", ")}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-800">{macros.calories}</p>
          <p className="text-xs text-gray-500">Calories</p>
        </div>
        <div className="bg-white p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-800">{macros.protein}g</p>
          <p className="text-xs text-gray-500">Protein</p>
        </div>
        <div className="bg-white p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-800">{macros.carbs}g</p>
          <p className="text-xs text-gray-500">Carbs</p>
        </div>
        <div className="bg-white p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-800">{macros.fat}g</p>
          <p className="text-xs text-gray-500">Fat</p>
        </div>
      </div>
      {macros.notes && macros.runCount > 1 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-green-700">Notes</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setNoteIndex((prev) => (prev > 0 ? prev - 1 : noteCount - 1))
                }
                className="p-1 rounded hover:bg-green-100"
              >
                <ChevronLeft className="w-4 h-4 text-green-700" />
              </button>
              <span className="text-xs text-green-600">
                {noteIndex + 1}/{noteCount}
              </span>
              <button
                onClick={() => setNoteIndex((prev) => (prev + 1) % noteCount)}
                className="p-1 rounded hover:bg-green-100"
              >
                <ChevronRightIcon className="w-4 h-4 text-green-700" />
              </button>
            </div>
          </div>
          <p className="text-sm text-green-800 bg-white p-2 rounded">
            {currentParsedNote?.note}
            {currentParsedNote && (
              <span className="block text-xs text-green-600 mt-1">
                ({currentParsedNote.modelUsed})
              </span>
            )}
          </p>
        </div>
      )}
      {parsedNotes.length === 1 && (
        <div className="mt-3">
          <span className="text-xs text-green-700">Notes</span>
          <p className="text-sm text-green-800 bg-white p-2 rounded">
            {parsedNotes[0].note}
            <span className="block text-xs text-green-600 mt-1">
              ({parsedNotes[0].modelUsed})
            </span>
          </p>
        </div>
      )}
    </div>
  );
}