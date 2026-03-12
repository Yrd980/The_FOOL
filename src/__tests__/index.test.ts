import { describe, expect, test } from "bun:test";
import type { EngineConfig } from "../types";
import { formatHelpText, parseArgs, validateOptions } from "../cli";

const baseConfig: EngineConfig = {
  width: 64,
  height: 64,
  rounds: 30,
  agentCount: 6,
  maxConcurrentAgents: 8,
  dryRun: false,
  model: "deepseek-chat"
};

describe("cli helpers", () => {
  test("collects unknown args for warning output", () => {
    const parsed = parseArgs(["--rounds=4", "--bogus=1"]);
    expect(parsed.unknownArgs).toEqual(["--bogus=1"]);
    expect(parsed.config.rounds).toBe(4);
  });

  test("reports the rejected value in validation errors", () => {
    expect(() => validateOptions({ ...baseConfig, width: 999 })).toThrow("width must be 8-256, got 999");
  });

  test("lists supported flags in help text", () => {
    expect(formatHelpText()).toContain("--dry-run");
    expect(formatHelpText()).toContain("--help");
  });

  test("help bypasses validation and unknown arg collection", () => {
    const parsed = parseArgs(["--help", "--width=999", "--bogus=1"]);
    expect(parsed.showHelp).toBe(true);
    expect(parsed.unknownArgs).toEqual([]);
  });
});
