// One-shot smoke check: one real image through the full 3-family OpenRouter path.
// Run: OPENROUTER_API_KEY=... npx tsx scripts/smoke-openrouter.ts
import fs from "fs";

const IMAGE = "/home/benkogan/.hermes/cache/images/img_f07cd30c7bc6.jpg";

async function main() {
  const { analyzeMeal } = await import("../src/services/openrouter");
  const { selectModels } = await import("../src/services/gemini-aggregation");
  const { densityFlag } = await import("../src/types/index");

  console.log("families:", selectModels().join("  |  "), "\n");

  const t0 = Date.now();
  const agg = await analyzeMeal(
    fs.readFileSync(IMAGE).toString("base64"),
    "image/jpeg",
    [
      {
        stationId: "wok",
        stationName: "Wok n Tandoor",
        name: "Sweet and Sour Pork",
        ingredients: ["pork shoulder", "cornstarch batter", "sweet chilli sauce"],
      },
      {
        stationId: "hot",
        stationName: "Hot Hands",
        name: "Egg Noodles",
        ingredients: ["egg noodles", "carrot", "celery", "onion"],
      },
    ],
    "",
  );
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`AGGREGATE  (${secs}s)`);
  console.log(`  calories   ${agg.calories}`);
  console.log(`  protein    ${agg.protein}g`);
  console.log(`  carbs      ${agg.carbs}g`);
  console.log(`  fat        ${agg.fat}g`);
  console.log(`  weight     ${agg.totalWeightG}g`);
  console.log(`  runs       ${agg.runCount} of 3`);
  console.log(`  spread     ${agg.spread?.calories} kcal / ${agg.spread?.weight}g`);
  console.log(`  lowConf    ${agg.lowConfidence}`);
  const density = agg.totalWeightG ? (agg.calories / agg.totalWeightG) * 100 : null;
  console.log(`  density    ${density ? Math.round(density) : "n/a"} kcal/100g`);
  const flag = densityFlag(agg);
  if (flag) console.log(`  WARNING    ${flag}`);
  console.log("\n  per-model:");
  for (const n of agg.notes) console.log(`   - ${n.modelUsed}: ${n.note.slice(0, 90)}`);
}

main();
