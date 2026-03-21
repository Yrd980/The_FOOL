import { afterEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const TEST_ACTIVITY_RUN_ID = "activity-run-01";
const TEST_ORCHESTRATOR_TOKEN = "test-orchestrator-token";

const children = new Set<ReturnType<typeof spawn>>();
const tempDirs = new Set<string>();
const servers = new Set<Server>();

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the child server is ready.
    }

    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for orchestrator health at ${baseUrl}.`);
};

const startOrchestrator = async (): Promise<string> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "molt-claw-control-"));
  tempDirs.add(dataDir);
  const port = 21000 + Math.floor(Math.random() * 10000);
  const child = spawn("bun", ["run", "./scripts/openclaw-orchestrator.ts"], {
    cwd: "/home/yrd/projects/The_FOOL/molt-claw",
    env: {
      ...process.env,
      OPENCLAW_ORCHESTRATOR_HOST: "127.0.0.1",
      OPENCLAW_ORCHESTRATOR_PORT: String(port),
      OPENCLAW_ORCHESTRATOR_TOKEN: TEST_ORCHESTRATOR_TOKEN,
      OPENCLAW_ORCHESTRATOR_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);
  return baseUrl;
};

const runControl = async (
  args: string[],
  env: Record<string, string>,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> => {
  const child = spawn("bun", ["run", "./scripts/openclaw-control.ts", ...args], {
    cwd: "/home/yrd/projects/The_FOOL/molt-claw",
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const [exitCode] = (await once(child, "exit")) as [number | null];
  children.delete(child);
  return {
    exitCode,
    stdout,
    stderr,
  };
};

const startWrongService = async (): Promise<string> => {
  const server = createServer((_req, res) => {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not here");
  });
  servers.add(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
  for (const server of [...servers]) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    servers.delete(server);
  }

  for (const child of [...children]) {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => undefined);
    children.delete(child);
  }

  for (const dir of [...tempDirs]) {
    await rm(dir, { recursive: true, force: true });
    tempDirs.delete(dir);
  }
});

describe("openclaw-control authoritative ascii", () => {
  test("renders authoritative ascii against a real local orchestrator", async () => {
    const baseUrl = await startOrchestrator();
    const result = await runControl(
      ["ascii", TEST_ACTIVITY_RUN_ID, "--limit", "4"],
      {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: TEST_ORCHESTRATOR_TOKEN,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("THE FOOL AUTHORITATIVE ASCII WATCH");
    expect(result.stdout).toContain("STAGE LADDER");
    expect(result.stdout).toContain("ROOMS");
    expect(result.stdout).toContain("RECENT AUTHORITATIVE EVENTS");
    expect(result.stdout).toContain("activity started -> act-1-intro");
  });

  test("fails clearly when the configured orchestrator URL points at the wrong service", async () => {
    const baseUrl = await startWrongService();
    const result = await runControl(
      ["ascii", TEST_ACTIVITY_RUN_ID, "--limit", "4"],
      {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: TEST_ORCHESTRATOR_TOKEN,
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("did not provide molt-claw's authoritative /api/orchestrator/snapshot");
    expect(result.stderr).toContain("Start this repo's scripts/openclaw-orchestrator.ts on a free port");
  });

  test("probe still reports authoritative orchestrator when gateway probing fails", async () => {
    const baseUrl = await startOrchestrator();
    const result = await runControl(
      ["probe"],
      {
        OPENCLAW_ORCHESTRATOR_URL: baseUrl,
        OPENCLAW_ORCHESTRATOR_TOKEN: TEST_ORCHESTRATOR_TOKEN,
        OPENCLAW_GATEWAY_URL: "ws://127.0.0.1:1",
        OPENCLAW_GATEWAY_TOKEN: TEST_ORCHESTRATOR_TOKEN,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"localOrchestrator"');
    expect(result.stdout).toContain('"status": "available"');
    expect(result.stdout).toContain('"gatewayProbe"');
    expect(result.stdout).toContain('"ok": false');
  });

  test("dispatches authoritative social commands and renders them in ascii", async () => {
    const baseUrl = await startOrchestrator();
    const sharedEnv = {
      OPENCLAW_ORCHESTRATOR_URL: baseUrl,
      OPENCLAW_ORCHESTRATOR_TOKEN: TEST_ORCHESTRATOR_TOKEN,
    };

    let result = await runControl(
      ["talk", TEST_ACTIVITY_RUN_ID, "I", "contain", "multitudes."],
      {
        ...sharedEnv,
        OPENCLAW_COMMAND_ACTOR_ID: "contestant-01",
        OPENCLAW_COMMAND_ACTOR_ROLE: "agent",
      },
    );
    expect(result.exitCode).toBe(0);

    result = await runControl(
      [
        "reaction",
        TEST_ACTIVITY_RUN_ID,
        "clap",
        "wild",
        "opening",
        "--target-entity-id",
        "contestant-01",
      ],
      {
        ...sharedEnv,
        OPENCLAW_COMMAND_ACTOR_ID: "contestant-02",
        OPENCLAW_COMMAND_ACTOR_ROLE: "agent",
      },
    );
    expect(result.exitCode).toBe(0);

    result = await runControl(
      ["bet", TEST_ACTIVITY_RUN_ID, "team", "team-1", "--amount", "3", "--stance", "upset-pick"],
      {
        ...sharedEnv,
        OPENCLAW_COMMAND_ACTOR_ID: "contestant-03",
        OPENCLAW_COMMAND_ACTOR_ROLE: "agent",
      },
    );
    expect(result.exitCode).toBe(0);

    result = await runControl(
      ["stage", TEST_ACTIVITY_RUN_ID, "act-3-assignment", "--confirm", "PROMOTE act-3-assignment"],
      {
        ...sharedEnv,
        OPENCLAW_COMMAND_ACTOR_ID: "host-01",
        OPENCLAW_COMMAND_ACTOR_ROLE: "host",
      },
    );
    expect(result.exitCode).toBe(0);

    result = await runControl(
      ["broadcast", TEST_ACTIVITY_RUN_ID, "Teams", "are", "locked", "in."],
      {
        ...sharedEnv,
        OPENCLAW_COMMAND_ACTOR_ID: "host-01",
        OPENCLAW_COMMAND_ACTOR_ROLE: "host",
      },
    );
    expect(result.exitCode).toBe(0);

    const ascii = await runControl(
      ["ascii", TEST_ACTIVITY_RUN_ID, "--limit", "12"],
      sharedEnv,
    );

    expect(ascii.exitCode).toBe(0);
    expect(ascii.stdout).toContain("LIVE SOCIAL");
    expect(ascii.stdout).toContain("contestant-01 :: talk @ main-stage: I contain multitudes.");
    expect(ascii.stdout).toContain("contestant-02 :: react clap -> contestant-01: wild opening");
    expect(ascii.stdout).toContain("contestant-03 :: bet team:team-1 amount=3 stance=upset-pick");
    expect(ascii.stdout).toContain("host-01 :: broadcast global: Teams are locked in.");
  });
});
