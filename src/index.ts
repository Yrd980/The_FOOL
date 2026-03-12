import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { formatHelpText, parseArgs, validateOptions } from "./cli";
import { PixelWarEngine } from "./engine";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.showHelp) {
    console.log(formatHelpText());
    return;
  }

  for (const arg of parsed.unknownArgs) {
    console.warn(`Unknown argument: ${arg}`);
  }

  validateOptions(parsed.config);

  const engine = new PixelWarEngine(parsed.config);
  const result = await engine.run();

  const outDir = path.resolve(__dirname, "..", "output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `replay-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  const top3 = result.ranking.slice(0, 3).map((item, index) => ({
    rank: index + 1,
    id: item.agent_id,
    score: item.final_score,
    territory: item.territory_cells
  }));

  const occupiedCells = result.ranking.reduce((sum, item) => sum + item.territory_cells, 0);
  const totalCells = result.config.width * result.config.height;
  const fillRate = totalCells > 0 ? Number((occupiedCells / totalCells).toFixed(4)) : 0;

  const errorStats = result.replay.reduce(
    (acc, round) => {
      for (const err of round.errors) {
        if (err.type === "schema_validation") acc.schema_validation += 1;
        if (err.type === "schema_repaired") acc.schema_repaired += 1;
        if (err.type === "decision_generation") acc.decision_generation += 1;
      }
      return acc;
    },
    { schema_validation: 0, schema_repaired: 0, decision_generation: 0 }
  );

  console.log(
    JSON.stringify(
      {
        message: "Simulation complete",
        output: outPath,
        top3,
        occupied_cells: occupiedCells,
        total_cells: totalCells,
        fill_rate: fillRate,
        error_stats: errorStats,
        mode: parsed.config.dryRun ? "dry-run" : "deepseek-live"
      },
      null,
      2
    )
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
