import type { EngineConfig } from "./types";

export interface ParsedCliOptions {
  config: EngineConfig;
  showHelp: boolean;
  unknownArgs: string[];
}

function defaultConfig(): EngineConfig {
  return {
    width: 64,
    height: 64,
    rounds: 30,
    agentCount: 6,
    maxConcurrentAgents: 8,
    dryRun: false,
    model: "deepseek-chat"
  };
}

export function formatHelpText(): string {
  return [
    "AI Pixel War CLI",
    "",
    "Flags:",
    "  --help, -h           Show help and exit",
    "  --dry-run            Use mock decisions instead of LLM calls",
    "  --rounds=<n>         Set round count (1-200)",
    "  --width=<n>          Set board width (8-256)",
    "  --height=<n>         Set board height (8-256)",
    "  --agents=<n>         Set agent count (2-30)",
    "  --concurrency=<n>    Set max concurrent agents (1-30)",
    "  --model=<name>       Set LLM model name",
    "  --profiles=<path>    Load twin profiles JSON",
    "  --myth=<text>        Override myth prompt",
    "  --theme=<text>       Alias for --myth"
  ].join("\n");
}

export function parseArgs(argv: string[]): ParsedCliOptions {
  const config = defaultConfig();
  if (argv.includes("--help") || argv.includes("-h")) {
    return { config, showHelp: true, unknownArgs: [] };
  }

  const unknownArgs: string[] = [];
  for (const arg of argv) {
    if (arg === "--dry-run") {
      config.dryRun = true;
      continue;
    }
    if (arg.startsWith("--rounds=")) {
      config.rounds = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--width=")) {
      config.width = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--height=")) {
      config.height = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--agents=")) {
      config.agentCount = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--model=")) {
      config.model = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      config.maxConcurrentAgents = Number(arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--profiles=")) {
      config.profilePath = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--myth=") || arg.startsWith("--theme=")) {
      config.mythPrompt = arg.split("=")[1];
      continue;
    }
    unknownArgs.push(arg);
  }

  return { config, showHelp: false, unknownArgs };
}

function rangeError(label: string, min: number, max: number, value: number): Error {
  return new Error(`${label} must be ${min}-${max}, got ${value}`);
}

export function validateOptions(options: EngineConfig): void {
  if (!Number.isInteger(options.width) || options.width < 8 || options.width > 256) {
    throw rangeError("width", 8, 256, options.width);
  }
  if (!Number.isInteger(options.height) || options.height < 8 || options.height > 256) {
    throw rangeError("height", 8, 256, options.height);
  }
  if (!Number.isInteger(options.rounds) || options.rounds < 1 || options.rounds > 200) {
    throw rangeError("rounds", 1, 200, options.rounds);
  }
  if (!Number.isInteger(options.agentCount) || options.agentCount < 2 || options.agentCount > 30) {
    throw rangeError("agents", 2, 30, options.agentCount);
  }
  if (
    !Number.isInteger(options.maxConcurrentAgents) ||
    options.maxConcurrentAgents < 1 ||
    options.maxConcurrentAgents > 30
  ) {
    throw rangeError("concurrency", 1, 30, options.maxConcurrentAgents);
  }
}
