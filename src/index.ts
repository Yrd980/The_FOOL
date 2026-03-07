import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PixelWarEngine } from "./engine";
import type { EngineConfig } from "./types";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]): EngineConfig {
  const options: EngineConfig = {
    width: 64,
    height: 64,
    rounds: 30,
    agentCount: 6,
    maxConcurrentAgents: 8,
    dryRun: false,
    model: "deepseek-chat"
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--rounds=")) {
      options.rounds = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--width=")) {
      options.width = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--height=")) {
      options.height = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--agents=")) {
      options.agentCount = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--model=")) {
      options.model = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      options.maxConcurrentAgents = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--profiles=")) {
      options.profilePath = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--myth=") || arg.startsWith("--theme=")) {
      options.mythPrompt = arg.split("=")[1];
      continue;
    }
  }

  return options;
}

function validateOptions(options: EngineConfig): void {
  const checks: Array<[boolean, string]> = [
    [Number.isInteger(options.width) && options.width >= 8 && options.width <= 256, "width must be 8-256"],
    [Number.isInteger(options.height) && options.height >= 8 && options.height <= 256, "height must be 8-256"],
    [Number.isInteger(options.rounds) && options.rounds >= 1 && options.rounds <= 200, "rounds must be 1-200"],
    [Number.isInteger(options.agentCount) && options.agentCount >= 2 && options.agentCount <= 30, "agents must be 2-30"],
    [
      Number.isInteger(options.maxConcurrentAgents) &&
        options.maxConcurrentAgents >= 1 &&
        options.maxConcurrentAgents <= 30,
      "concurrency must be 1-30"
    ]
  ];

  const failed = checks.find(([ok]) => !ok);
  if (failed) {
    throw new Error(failed[1]);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  validateOptions(options);

  const engine = new PixelWarEngine(options);
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
        mode: options.dryRun ? "dry-run" : "deepseek-live"
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
