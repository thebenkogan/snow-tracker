// Verifies the aggregation changes without needing a Gemini key.
// Run: npx tsx scripts/test-aggregation.ts  (or via the dev server's TS runner)
import { generateMealPrompt } from "../src/utils/meal";
import {
  selectModels,
  aggregateTrials,
  caloriesFromMacros,
  maxTokensFor,
  median,
} from "../src/services/gemini-aggregation";
import { impliedDensity, densityFlag, DENSITY_RANGE } from "../src/types/index";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!cond) failures++;
}

// 1. single model
check("one trial", selectModels().length === 1);
check("model is gemini flash-lite", selectModels()[0] === "google/gemini-3.1-flash-lite", selectModels()[0]);
check("max tokens default", maxTokensFor("qwen/qwen3.8-omni-flash") === 900);
check("max tokens override for ling", maxTokensFor("inclusionai/ling-3.0-flash-vl") === 2500);

// 3. median + derived calories are internally consistent
const runs = [
  { calories: 700, protein: 30, carbs: 80, fat: 25, totalWeightG: 250 },
  { calories: 450, protein: 28, carbs: 50, fat: 12, totalWeightG: 180 },
  { calories: 650, protein: 29, carbs: 65, fat: 18, totalWeightG: 220 },
];
const p = median(runs.map((r) => r.protein));
const c = median(runs.map((r) => r.carbs));
const f = median(runs.map((r) => r.fat));
const cal = caloriesFromMacros({ protein: p, carbs: c, fat: f });
check("median resists outlier", p === 29 && c === 65, `p=${p} c=${c}`);
check("calories derived from medians", cal === 538, `got ${cal}`);
check(
  "derived calories == 4p+4c+9f",
  cal === 4 * p + 4 * c + 9 * f,
);

// 4. median beats mean for this outlier case
const meanCal = (700 + 450 + 650) / 3;
check("mean would have been 600", Math.round(meanCal) === 600, `${meanCal}`);

// 5. weight median + spread
const w = runs.map((r) => r.totalWeightG!);
check("median weight", median(w) === 220, `${median(w)}`);
check("weight spread", Math.max(...w) - Math.min(...w) === 70);

// 6. density sanity check
check("normal density not flagged", densityFlag({ calories: 538, totalWeightG: 220 }) === null);
const dense = densityFlag({ calories: 900, totalWeightG: 150 });
check("absurd density flagged", dense !== null, String(dense));
const light = densityFlag({ calories: 80, totalWeightG: 400 });
check("absurdly light flagged", light !== null, String(light));
check("missing weight no crash", densityFlag({ calories: 500, totalWeightG: undefined }) === null);
check(
  "impliedDensity math",
  Math.abs(impliedDensity({ calories: 550, totalWeightG: 250 })! - 220) < 0.001,
);

// 7. the prompt: candidates framing, no quantity claim, weight-first ordering
const prompt = generateMealPrompt(
  [
    {
      stationId: "wok",
      stationName: "Wok n Tandoor",
      name: "Sweet and Sour Pork",
      ingredients: ["pork", "batter", "sauce"],
    },
    {
      stationId: "noodle",
      stationName: "Hot Hands",
      name: "Egg Noodles",
      ingredients: ["noodles", "carrot"],
    },
  ],
  "extra note here",
);
check("prompt says candidates", prompt.includes("candidate items"));
check("prompt disclaims quantity", prompt.includes("NOTHING about quantity"));
check("prompt asks for grams first", prompt.indexOf("total weight") < prompt.indexOf("Convert to macros"));
check("prompt requests total_weight_g", prompt.includes("total_weight_g"));
check("prompt passes notes through", prompt.includes("extra note here"));
check("prompt does not assert servings", !prompt.includes("serving of each"));

// 9. single-trial aggregation omits spread and lowConfidence (nothing to disagree about)
const one = aggregateTrials([
  { calories: 700, protein: 30, carbs: 80, fat: 25, totalWeightG: 250, notes: "x", modelUsed: "m" },
]);
check("single trial has runCount 1", one.runCount === 1);
check("single trial omits spread", one.spread === undefined);
check("single trial omits lowConfidence", one.lowConfidence === undefined);
check("single trial keeps weight", one.totalWeightG === 250);
check("single trial calories derived", one.calories === caloriesFromMacros({ protein: 30, carbs: 80, fat: 25 }));

const two = aggregateTrials(runs as never);
check("two trials report spread", typeof two.spread?.calories === "number", String(two.spread?.calories));

// 10. empty trials degrade gracefully
const none = aggregateTrials([]);
check("empty trials -> zero macros", none.calories === 0 && none.runCount === 0);

console.log(`\nDENSITY_RANGE = ${DENSITY_RANGE.min}-${DENSITY_RANGE.max} kcal/100g`);
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
