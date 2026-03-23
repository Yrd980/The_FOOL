import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCommandConfirmation,
  normalizeControlConfigValue,
  normalizeOrchestratorBaseUrl,
  type ControlActorRole,
} from "../../src/openclaw/control";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const devRoot = path.resolve(scriptDir, "../..");
const envFilePath = path.join(devRoot, ".env.local");

const parseEnvFile = (filePath: string): Record<string, string> => {
  try {
    const source = readFileSync(filePath, "utf8");
    const entries = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index < 0) {
          return null;
        }

        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return key ? [key, value] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const envFile = parseEnvFile(envFilePath);

export const resolveConfigValue = (key: string): string | undefined =>
  normalizeControlConfigValue(process.env[key]) ??
  normalizeControlConfigValue(envFile[key]);

export const USAGE = `Usage:
  bun run openclaw:control -- probe
  bun run openclaw:control -- move <agent-id> <room> --activity-run-id <id>
  bun run openclaw:control -- say <agent-id> <room> <message> --activity-run-id <id>
  bun run openclaw:control -- talk <activity-run-id> <message...> [--room-id <room-id>] [--target-entity-id <entity-id>] [--audience-scope <room|team|global>]
  bun run openclaw:control -- broadcast <activity-run-id> <message...> [--room-id <room-id>] [--team-id <team-id>] [--audience-scope <room|team|global>]
  bun run openclaw:control -- reaction <activity-run-id> <reaction> [note...] [--room-id <room-id>] [--target-entity-id <entity-id>] [--target-team-id <team-id>]
  bun run openclaw:control -- bet <activity-run-id> <team|entity|submission> <target-id> [--amount <n>] [--odds <n>] [--stance <text>] [--note <text>] [--room-id <room-id>]
  bun run openclaw:control -- vote <activity-run-id> <team|entity|submission> <target-id> [--value <n>] [--note <text>] [--room-id <room-id>]
  bun run openclaw:control -- stage <activity-run-id> <target-stage-id>
  bun run openclaw:control -- finish <activity-run-id> <team|entity|submission|push> [target-id] [--note <text>]
  bun run openclaw:control -- start-timer <activity-run-id> <stage-id> <duration-sec>
  bun run openclaw:control -- open-submission <activity-run-id> <submission-id>
  bun run openclaw:control -- submit <activity-run-id> <submission-id> <payload-json>
  bun run openclaw:control -- update-submission <activity-run-id> <submission-id> <payload-json>
  bun run openclaw:control -- lock-submission <activity-run-id> <submission-id>
  bun run openclaw:control -- submit-score <activity-run-id> <submission-id> <score-1..10> --reason <text> --annotations-json <json>
  bun run openclaw:control -- grant-award <activity-run-id> <award-id> <entity-id> [label] [reason]
  bun run openclaw:control -- draw <activity-run-id> <entity-id> <draw-data-json>
  bun run openclaw:control -- move-entity <activity-run-id> <entity-id> <to-room-id> [kind]
  bun run openclaw:control -- assign-team <activity-run-id> <team-id> [--members <id,id,...>] [--room-id <room-id>]
  bun run openclaw:control -- ascii <activity-run-id> [--limit <n>] [--watch <seconds>]
  bun run openclaw:control -- snapshot <activity-run-id>
  bun run openclaw:control -- scores <activity-run-id> [--after-sequence <n>] [--from-sequence <n>] [--to-sequence <n>] [--limit <n>]
  bun run openclaw:control -- events <activity-run-id> [--after-sequence <n>] [--from-sequence <n>] [--to-sequence <n>] [--limit <n>]
  bun run openclaw:control -- replay <activity-run-id> [--after-sequence <n>] [--from-sequence <n>] [--to-sequence <n>] [--limit <n>]
  bun run openclaw:control -- audit <activity-run-id> [--limit <n>]
  bun run openclaw:control -- command <activity-run-id> <command-type> <payload-json>

Room alias resolution for move/say:
  - aliases resolve only against the authoritative snapshot.world catalog for the requested activity
  - configured activity examples: main | team1 | team2 | team3 | quiet
  - configured activity room ids: main-stage | team-room-1 | team-room-2 | team-room-3 | quiet-orbit

Required env for authoritative command/query dispatch:
  OPENCLAW_ACTIVITY_RUN_ID=<authoritative-run-id>
  OPENCLAW_ACTIVITY_TEMPLATE_ID=<authoritative-template-id>
  OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:<authoritative-port>
  OPENCLAW_ORCHESTRATOR_TOKEN=<local-backend-token>
  OPENCLAW_GATEWAY_URL=ws://127.0.0.1:<gateway-port>
  OPENCLAW_GATEWAY_TOKEN=<gateway-token>
  OPENCLAW_COMMAND_ACTOR_ID=<authoritative-actor-id>
  OPENCLAW_COMMAND_ACTOR_ROLE=<host|agent|judge|viewer|admin>

Dangerous orchestrator mutations require --confirm <challenge> when they are actually dispatched:
  stage -> --confirm "PROMOTE <target-stage-id>"
  finish -> --confirm "FINISH <activity-run-id> <target-type>:<target-id>" or --confirm "FINISH <activity-run-id> push"
  lock-submission -> --confirm "LOCK <submission-id>"
  grant-award -> --confirm "AWARD <award-id> <entity-id>"
  move-entity -> --confirm "MOVE <entity-id> <to-room-id>"
  assign-team -> --confirm "ASSIGN <team-id>"`;

export const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readString = (
  record: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

export const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

export const formatOrchestratorError = (
  payload: unknown,
  fallback: string,
): string => {
  if (!isRecord(payload)) {
    return fallback;
  }

  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }

  if (isRecord(payload.error)) {
    const code = readString(payload.error, "code");
    const message = readString(payload.error, "message") ?? fallback;
    const confirmation =
      isRecord(payload.error.confirmation)
        ? readString(payload.error.confirmation, "challenge")
        : null;
    const detail = confirmation
      ? `${message} Use --confirm ${JSON.stringify(confirmation)}.`
      : message;
    return code ? `[${code}] ${detail}` : detail;
  }

  return fallback;
};

export const printJsonAndExit = (value: unknown): never => {
  console.log(JSON.stringify(value, null, 2));
  process.exit(0);
};

export const requestLocalOrchestrator = async ({
  url,
  token,
  method = "GET",
  body,
}: {
  url: string;
  token: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<unknown> => {
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let responseBody: unknown = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    fail(
      `[openclaw-control] Local orchestrator request failed: ${formatOrchestratorError(responseBody, `HTTP ${response.status}`)}`,
    );
  }

  return responseBody;
};

export const buildLocalOrchestratorFailureNote = ({
  baseUrl,
  activityRunId,
  httpStatus,
  reason,
}: {
  baseUrl: string;
  activityRunId: string;
  httpStatus?: number | null;
  reason: string;
}): string => {
  const httpLabel =
    typeof httpStatus === "number" ? ` (HTTP ${httpStatus})` : "";
  return (
    `OPENCLAW_ORCHESTRATOR_URL ${baseUrl} did not provide molt-claw's authoritative /api/orchestrator/snapshot for ${activityRunId}${httpLabel}. ` +
    `${reason} Start this repo's scripts/openclaw-orchestrator.ts on a free port and point OPENCLAW_ORCHESTRATOR_URL at that server.`
  );
};

export const runOpenClaw = (args: string[]): never => {
  const result = spawnSync("openclaw", args, {
    cwd: devRoot,
    stdio: "inherit",
  });

  if (result.error) {
    fail(`Failed to run openclaw: ${result.error.message}`);
  }

  process.exit(result.status ?? 0);
};

export const runOpenClawJson = (args: string[]): unknown => {
  const result = spawnSync("openclaw", args, {
    cwd: devRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(
      `Failed to run openclaw ${args.join(" ")}: ${result.error.message}`,
    );
  }

  if ((result.status ?? 1) !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const detail = stderr || stdout || `exit ${result.status ?? 1}`;
    throw new Error(`openclaw ${args.join(" ")} failed: ${detail}`);
  }

  const stdout = result.stdout?.trim();
  if (!stdout) {
    throw new Error(`openclaw ${args.join(" ")} returned empty output.`);
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `openclaw ${args.join(" ")} returned invalid JSON: ${(error as Error).message}`,
    );
  }
};

export const resolveGatewayToken = (): string | undefined =>
  resolveConfigValue("OPENCLAW_GATEWAY_TOKEN");

export const resolveOrchestratorBaseUrl = (): string =>
  normalizeOrchestratorBaseUrl(resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL"));

export const resolveOrchestratorToken = (): string | undefined =>
  resolveConfigValue("OPENCLAW_ORCHESTRATOR_TOKEN");

export const resolveConfiguredActivityRunId = (
  explicitActivityRunId?: string | null,
): string => {
  const activityRunId =
    explicitActivityRunId?.trim() ?? resolveConfigValue("OPENCLAW_ACTIVITY_RUN_ID");
  if (!activityRunId) {
    return fail(
      "Missing authoritative activity run id. Pass <activity-run-id> or set OPENCLAW_ACTIVITY_RUN_ID.",
    );
  }
  return activityRunId;
};

export const resolveLocalOrchestratorAuth = (): {
  baseUrl: string;
  token: string;
} => {
  const token = resolveOrchestratorToken();
  if (!token) {
    return fail(
      "Missing local orchestrator token. Set OPENCLAW_ORCHESTRATOR_TOKEN.",
    );
  }

  return {
    baseUrl: resolveOrchestratorBaseUrl(),
    token,
  };
};

export const resolveActorId = (): string =>
  resolveConfigValue("OPENCLAW_COMMAND_ACTOR_ID") ??
  fail("Missing authoritative actor id. Set OPENCLAW_COMMAND_ACTOR_ID.");

export const resolveActorRole = (): ControlActorRole => {
  const value = resolveConfigValue("OPENCLAW_COMMAND_ACTOR_ROLE");
  if (
    value === "agent" ||
    value === "host" ||
    value === "judge" ||
    value === "viewer" ||
    value === "admin"
  ) {
    return value;
  }

  return fail(
    "Missing authoritative actor role. Set OPENCLAW_COMMAND_ACTOR_ROLE to host, agent, judge, viewer, or admin.",
  );
};

export const readCommandConfirmation = (challenge: string | undefined) =>
  challenge ? buildCommandConfirmation(challenge) : undefined;
