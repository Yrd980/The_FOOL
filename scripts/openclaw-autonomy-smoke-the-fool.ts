#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const cwd = "/home/yrd/projects/The_FOOL/molt-claw";
const activityRunId = "activity-run-01";
const orchestratorToken = "the-fool-autonomy-smoke-token";

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl + "/health");
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the child server is ready.
    }

    await Bun.sleep(100);
  }

  throw new Error("Timed out waiting for orchestrator health at " + baseUrl + ".");
};

const runChild = async ({
  args,
  env,
}: {
  args: string[];
  env: Record<string, string>;
}): Promise<{ exitCode: number | null; stdout: string; stderr: string }> => {
  const child = spawn("bun", ["run", ...args], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const [exitCode] = (await once(child, "exit")) as [number | null];
  return { exitCode, stdout, stderr };
};

const runChildOrThrow = async ({
  label,
  args,
  env,
}: {
  label: string;
  args: string[];
  env: Record<string, string>;
}): Promise<string> => {
  const result = await runChild({ args, env });
  if (result.exitCode !== 0) {
    throw new Error(
      "[" +
        label +
        "] failed with exit=" +
        String(result.exitCode) +
        "\nstdout:\n" +
        result.stdout +
        "\nstderr:\n" +
        result.stderr,
    );
  }
  return result.stdout;
};

const assertContains = ({
  output,
  label,
  fragments,
}: {
  output: string;
  label: string;
  fragments: string[];
}): void => {
  for (const fragment of fragments) {
    if (!output.includes(fragment)) {
      throw new Error(
        "[" +
          label +
          "] expected output to include " +
          JSON.stringify(fragment) +
          ".\nOutput:\n" +
          output,
      );
    }
  }
};

const main = async (): Promise<void> => {
  const dataDir = await mkdtemp(
    path.join(tmpdir(), "molt-claw-autonomy-smoke-orchestrator-"),
  );
  const ledgerDir = await mkdtemp(
    path.join(tmpdir(), "molt-claw-autonomy-smoke-ledger-"),
  );
  const port = 26000 + Math.floor(Math.random() * 1000);
  const baseUrl = "http://127.0.0.1:" + String(port);
  let child: ReturnType<typeof spawn> | null = null;

  try {
    child = spawn("bun", ["run", "./scripts/openclaw-orchestrator.ts"], {
      cwd,
      env: {
        ...process.env,
        OPENCLAW_ORCHESTRATOR_HOST: "127.0.0.1",
        OPENCLAW_ORCHESTRATOR_PORT: String(port),
        OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
        OPENCLAW_ORCHESTRATOR_DATA_DIR: dataDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!child.stdout || !child.stderr) {
      throw new Error("Expected orchestrator child process pipes.");
    }
    child.stdout.on("data", () => {});
    child.stderr.on("data", () => {});

    await waitForHealth(baseUrl);

    console.log("[autonomy-smoke] starting autonomous full run");
    const autonomyOutput = await runChildOrThrow({
      label: "autonomy",
      args: ["./scripts/openclaw-autonomy-the-fool.ts", activityRunId],
      env: {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
        OPENCLAW_AUTONOMY_LEDGER_DIR: ledgerDir,
      },
    });
    assertContains({
      output: autonomyOutput,
      label: "autonomy",
      fragments: [
        "stage=act-1-intro",
        "stage=act-7-ai-judging",
        "stage=act-10-open-mic",
        "status=finished",
      ],
    });

    const asciiOutput = await runChildOrThrow({
      label: "ascii",
      args: ["./scripts/openclaw-control.ts", "ascii", activityRunId, "--limit", "60"],
      env: {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
      },
    });
    assertContains({
      output: asciiOutput,
      label: "ascii",
      fragments: [
        "status   : finished",
        "stage    : act-10-open-mic",
        "poem-alpha",
        "Most Absurd",
        "bet_settlements",
      ],
    });

    const snapshotOutput = await runChildOrThrow({
      label: "snapshot",
      args: ["./scripts/openclaw-control.ts", "snapshot", activityRunId],
      env: {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
      },
    });
    assertContains({
      output: snapshotOutput,
      label: "snapshot",
      fragments: [
        "\"status\": \"finished\"",
        "\"currentStageId\": \"act-10-open-mic\"",
        "\"betSettlements\"",
        "\"scores\"",
      ],
    });

    const eventsOutput = await runChildOrThrow({
      label: "events",
      args: ["./scripts/openclaw-control.ts", "events", activityRunId, "--limit", "80"],
      env: {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
      },
    });
    assertContains({
      output: eventsOutput,
      label: "events",
      fragments: [
        "\"type\": \"judge.score_submitted\"",
        "\"type\": \"draw.submitted\"",
        "\"type\": \"activity.finished\"",
      ],
    });

    console.log("[autonomy-smoke] The Fool autonomous full run passed.");
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
    }
    await rm(dataDir, { recursive: true, force: true });
    await rm(ledgerDir, { recursive: true, force: true });
  }
};

await main();
