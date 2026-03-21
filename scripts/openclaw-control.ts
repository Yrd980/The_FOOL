#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GATEWAY_CONNECT_CLIENT_ID,
  GATEWAY_CONNECT_CLIENT_MODE,
  GATEWAY_OPERATOR_READ_SCOPE,
  buildCommandEnvelope,
  buildCommandConfirmation,
  buildFinishActivityEnvelope,
  buildGrantAwardEnvelope,
  buildGatewayAgentCallArgs,
  buildGatewayDispatchCommandArgs,
  buildLockSubmissionEnvelope,
  buildMoveMessage,
  buildOpenSubmissionEnvelope,
  buildOrchestratorAuditUrl,
  buildOrchestratorCommandUrl,
  buildOrchestratorEventsUrl,
  buildOrchestratorReplayUrl,
  buildOrchestratorScoresUrl,
  buildOrchestratorSnapshotUrl,
  buildSubmitEnvelope,
  buildAssignTeamEnvelope,
  buildBetEnvelope,
  buildBroadcastEnvelope,
  buildMoveEntityEnvelope,
  buildReactionEnvelope,
  buildSubmitScoreEnvelope,
  buildStartTimerEnvelope,
  buildTalkEnvelope,
  buildTransitionStageEnvelope,
  buildUpdateSubmissionEnvelope,
  buildVoteEnvelope,
  normalizeControlConfigValue,
  normalizeControlDispatchMethod,
  normalizeControlGatewayUrl,
  normalizeOrchestratorBaseUrl,
  resolveControlRoomId,
  resolveDangerousCommandConfirmationRequirement,
  satisfiesDangerousCommandConfirmation,
  summarizeGatewayOrchestrationContract,
  type CommandEnvelope,
  type ControlActorRole,
  type GatewayCapabilitySnapshot,
  type OrchestratorEventQuery,
  type SubmitScorePayload,
} from "../src/openclaw/control";
import {
  getActivityCliCompatScoreAnnotationOptions,
  buildWorldRoomCatalog,
  tryBuildBootstrapRoomCatalog,
  tryResolveActivityPackageId,
  type ActivityRoomCatalog,
} from "../src/openclaw/activityRuntime";
import { buildOpenClawAsciiOverview } from "../src/openclaw/asciiOverview";
import { resolveLocalPlatformBootstrapConfig } from "../src/openclaw/localPlatformConfig";
import type { WorldProjection } from "../src/openclaw/platform/contracts";
import type {
  OrchestratorEventPage,
  OrchestratorSnapshotResponse,
} from "../src/openclaw/orchestratorQueryClient";

type CommandName =
  | "probe"
  | "move"
  | "say"
  | "talk"
  | "broadcast"
  | "reaction"
  | "bet"
  | "vote"
  | "stage"
  | "finish"
  | "start-timer"
  | "open-submission"
  | "submit"
  | "update-submission"
  | "lock-submission"
  | "submit-score"
  | "grant-award"
  | "draw"
  | "move-entity"
  | "assign-team"
  | "ascii"
  | "snapshot"
  | "scores"
  | "events"
  | "replay"
  | "audit"
  | "command";

interface GatewayHelloSummary {
  snapshotKeys: string[];
  healthKeys: string[];
  agentCount: number;
  serviceTs: number | null;
}

interface GatewayStatusSummary {
  ok: boolean;
  error: string | null;
  sessionCount: number | null;
  recentSessionKeys: string[];
}

interface GatewayProbeSummary extends GatewayCapabilitySnapshot {
  hello: GatewayHelloSummary;
  status: GatewayStatusSummary;
}

interface PairedCliStatusSummary {
  runtimeVersion: string | null;
  sessionCount: number | null;
  recentSessionKeys: string[];
  channelSummary: string[];
}

interface ToolsCatalogSummary {
  profileIds: string[];
  pluginGroups: Array<{
    id: string;
    pluginId: string | null;
    toolCount: number;
  }>;
}

interface ConfigPluginSummary {
  allow: string[];
  enabledEntries: string[];
  installs: Array<{
    id: string;
    source: string | null;
    spec: string | null;
    installPath: string | null;
    version: string | null;
  }>;
}

interface LoadedPluginSummary {
  id: string;
  enabled: boolean;
  status: string | null;
  origin: string | null;
  toolNames: string[];
  hookNames: string[];
  gatewayMethods: string[];
  services: string[];
  commands: string[];
  cliCommands: string[];
  channelIds: string[];
  providerIds: string[];
}

interface PairedCliProbeSummary {
  status: PairedCliStatusSummary;
  toolsCatalog: ToolsCatalogSummary;
  configPlugins: ConfigPluginSummary;
  loadedPlugins: LoadedPluginSummary[];
  runtimeInference: string;
}

interface LocalOrchestratorProbeSummary {
  baseUrl: string;
  activityRunId: string;
  status:
    | "available"
    | "auth-missing"
    | "http-error"
    | "wrong-service"
    | "unreachable";
  httpStatus: number | null;
  note: string;
  snapshotKeys: string[];
  templateId: string | null;
  currentStageId: string | null;
  snapshotResponse: OrchestratorSnapshotResponse | null;
}

interface AgentCommandActivityContext {
  activityPackageId: string | null;
  roomCatalog: ActivityRoomCatalog | null;
  note: string | null;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const devRoot = path.resolve(scriptDir, "..");
const envFilePath = path.join(devRoot, ".env.local");
const openClawConfigPath = path.join(
  process.env.HOME ?? "",
  ".openclaw",
  "openclaw.json",
);
const KNOWN_STOCK_PLUGIN_IDS = new Set([
  "memory-core",
  "telegram",
  "camofox-browser",
]);

const parseEnvFile = (filePath: string): Record<string, string> => {
  try {
    const source = readFileSync(filePath, "utf8");
    const entries = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index < 0) return null;
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

const parseGatewayTokenFromOpenClawConfig = (
  filePath: string,
): string | undefined => {
  try {
    const source = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(source) as {
      gateway?: { auth?: { token?: string } };
    };
    return normalizeControlConfigValue(parsed.gateway?.auth?.token);
  } catch {
    return undefined;
  }
};

const openClawGatewayToken =
  parseGatewayTokenFromOpenClawConfig(openClawConfigPath);

const resolveConfigValue = (key: string): string | undefined =>
  normalizeControlConfigValue(process.env[key]) ??
  normalizeControlConfigValue(envFile[key]);

const resolveCliCompatActivityPackageId = (): string =>
  resolveConfigValue("OPENCLAW_REFERENCE_ACTIVITY_TEMPLATE_ID") ??
  resolveConfigValue("OPENCLAW_ACTIVITY_TEMPLATE_ID") ??
  resolveLocalPlatformBootstrapConfig().defaultTemplateId;

const legacyScoreCompatOptions = getActivityCliCompatScoreAnnotationOptions(
  resolveCliCompatActivityPackageId(),
);

const legacyScoreCompatUsage = legacyScoreCompatOptions
  .map((option) => option.description)
  .filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  )
  .join(" ");

const USAGE = `Usage:
  bun run openclaw:control -- probe
  bun run openclaw:control -- move <agent-id> <room> [--activity-run-id <id>] [--activity-package-id <id>]
  bun run openclaw:control -- say <agent-id> <room> <message> [--activity-run-id <id>] [--activity-package-id <id>]
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
  ${legacyScoreCompatUsage ? `bun run openclaw:control -- submit-score <activity-run-id> <submission-id> <score-1..10> --reason <text> ${legacyScoreCompatUsage}\n` : ""}  bun run openclaw:control -- grant-award <activity-run-id> <award-id> <entity-id> [label] [reason]
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
  - with OPENCLAW_ORCHESTRATOR_URL, aliases resolve against the authoritative snapshot.world catalog for the current activity
  - with --activity-package-id, aliases resolve against that activity package's bootstrap/dev room catalog only
  - shorthand aliases are not resolved against an implicit default reference activity anymore
  - configured activity examples: main | team1 | team2 | team3 | quiet
  - configured activity room ids: main-stage | team-room-1 | team-room-2 | team-room-3 | quiet-orbit

Optional env for command dispatch:
  OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791
  OPENCLAW_ORCHESTRATOR_TOKEN=<local-backend-token>
  OPENCLAW_COMMAND_METHOD=<verified-live-method>
  OPENCLAW_COMMAND_PARAM_KEY=command
  OPENCLAW_COMMAND_ACTOR_ID=molt-claw
  OPENCLAW_COMMAND_ACTOR_ROLE=host

Dangerous orchestrator mutations require --confirm <challenge> when they are actually dispatched:
  stage -> --confirm "PROMOTE <target-stage-id>"
  finish -> --confirm "FINISH <activity-run-id> <target-type>:<target-id>" or --confirm "FINISH <activity-run-id> push"
  lock-submission -> --confirm "LOCK <submission-id>"
  grant-award -> --confirm "AWARD <award-id> <entity-id>"
  move-entity -> --confirm "MOVE <entity-id> <to-room-id>"
  assign-team -> --confirm "ASSIGN <team-id>"`;

const resolveGatewayToken = (): string | undefined =>
  resolveConfigValue("OPENCLAW_GATEWAY_TOKEN") ??
  openClawGatewayToken;

const resolveOrchestratorBaseUrl = (): string =>
  normalizeOrchestratorBaseUrl(resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL"));

const resolveOrchestratorToken = (): string | undefined =>
  resolveConfigValue("OPENCLAW_ORCHESTRATOR_TOKEN") ??
  resolveConfigValue("OPENCLAW_GATEWAY_TOKEN") ??
  openClawGatewayToken;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWorldProjection = (value: unknown): value is WorldProjection =>
  isRecord(value) &&
  Array.isArray(value.rooms) &&
  Array.isArray(value.teams) &&
  Array.isArray(value.entities);

const isOrchestratorSnapshotResponse = (
  value: unknown,
): value is OrchestratorSnapshotResponse => {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.snapshot)) {
    return false;
  }

  const activityRun = isRecord(value.snapshot.activityRun)
    ? value.snapshot.activityRun
    : null;

  return (
    activityRun !== null &&
    typeof activityRun.id === "string" &&
    typeof activityRun.status === "string"
  );
};

const readString = (
  record: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

const formatOrchestratorError = (
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

const printJsonAndExit = (value: unknown): never => {
  console.log(JSON.stringify(value, null, 2));
  process.exit(0);
};

const requestLocalOrchestrator = async ({
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

const buildLocalOrchestratorFailureNote = ({
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

const runOpenClaw = (args: string[]): never => {
  const result = spawnSync("openclaw", args, {
    cwd: devRoot,
    stdio: "inherit",
  });

  if (result.error) {
    fail(`Failed to run openclaw: ${result.error.message}`);
  }

  process.exit(result.status ?? 0);
};

const runOpenClawJson = (args: string[]): unknown => {
  const result = spawnSync("openclaw", args, {
    cwd: devRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Failed to run openclaw ${args.join(" ")}: ${result.error.message}`);
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

const summarizeStatusPayload = (payload: unknown): {
  sessionCount: number | null;
  recentSessionKeys: string[];
} => {
  if (typeof payload !== "object" || payload === null) {
    return { sessionCount: null, recentSessionKeys: [] };
  }

  const record = payload as {
    sessions?: {
      count?: unknown;
      recent?: Array<{ key?: unknown }>;
      byAgent?: Array<{ recent?: Array<{ key?: unknown }> }>;
    };
  };

  const recentEntries = Array.isArray(record.sessions?.recent)
    ? record.sessions.recent
    : Array.isArray(record.sessions?.byAgent)
      ? record.sessions.byAgent.flatMap((group) =>
          Array.isArray(group.recent) ? group.recent : [],
        )
      : [];

  return {
    sessionCount:
      typeof record.sessions?.count === "number"
        ? record.sessions.count
        : Array.isArray(recentEntries)
          ? recentEntries.length
          : null,
    recentSessionKeys: recentEntries
      .map((entry) => (typeof entry?.key === "string" ? entry.key : null))
      .filter((key): key is string => key !== null)
      .slice(0, 6),
  };
};

const summarizePairedCliStatus = (payload: unknown): PairedCliStatusSummary => {
  const summary = summarizeStatusPayload(payload);
  if (!isRecord(payload)) {
    return {
      runtimeVersion: null,
      sessionCount: summary.sessionCount,
      recentSessionKeys: summary.recentSessionKeys,
      channelSummary: [],
    };
  }

  return {
    runtimeVersion: readString(payload, "runtimeVersion"),
    sessionCount: summary.sessionCount,
    recentSessionKeys: summary.recentSessionKeys,
    channelSummary: readStringArray(payload.channelSummary),
  };
};

const summarizeToolsCatalog = (payload: unknown): ToolsCatalogSummary => {
  if (!isRecord(payload)) {
    return { profileIds: [], pluginGroups: [] };
  }

  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];

  return {
    profileIds: profiles
      .map((profile) =>
        isRecord(profile) ? readString(profile, "id") : null,
      )
      .filter((id): id is string => id !== null),
    pluginGroups: groups
      .map((group) => {
        if (!isRecord(group)) {
          return null;
        }

        const tools = Array.isArray(group.tools) ? group.tools : [];
        return {
          id: readString(group, "id") ?? "unknown-group",
          pluginId: readString(group, "pluginId"),
          source: readString(group, "source"),
          toolCount: tools.length,
        };
      })
      .filter(
        (
          group,
        ): group is {
          id: string;
          pluginId: string | null;
          source: string | null;
          toolCount: number;
        } => group !== null && group.source === "plugin",
      )
      .map(({ id, pluginId, toolCount }) => ({ id, pluginId, toolCount })),
  };
};

const summarizeConfigPlugins = (payload: unknown): ConfigPluginSummary => {
  if (!isRecord(payload)) {
    return { allow: [], enabledEntries: [], installs: [] };
  }

  const config = isRecord(payload.config)
    ? payload.config
    : isRecord(payload.parsed)
      ? payload.parsed
      : null;
  const plugins = config && isRecord(config.plugins) ? config.plugins : null;
  const entries =
    plugins && isRecord(plugins.entries) ? plugins.entries : undefined;
  const installs =
    plugins && isRecord(plugins.installs) ? plugins.installs : undefined;

  return {
    allow: readStringArray(plugins?.allow),
    enabledEntries: entries
      ? Object.entries(entries)
          .filter(
            ([, value]) => isRecord(value) && value.enabled === true,
          )
          .map(([id]) => id)
      : [],
    installs: installs
      ? Object.entries(installs).map(([id, value]) => ({
          id,
          source: isRecord(value) ? readString(value, "source") : null,
          spec: isRecord(value) ? readString(value, "spec") : null,
          installPath: isRecord(value) ? readString(value, "installPath") : null,
          version: isRecord(value) ? readString(value, "version") : null,
        }))
      : [],
  };
};

const summarizeLoadedPlugins = (payload: unknown): LoadedPluginSummary[] => {
  if (!isRecord(payload) || !Array.isArray(payload.plugins)) {
    return [];
  }

  return payload.plugins
    .filter(
      (plugin): plugin is Record<string, unknown> =>
        isRecord(plugin) &&
        (plugin.enabled === true || readString(plugin, "status") === "loaded"),
    )
    .map((plugin) => ({
      id: readString(plugin, "id") ?? "unknown-plugin",
      enabled: plugin.enabled === true,
      status: readString(plugin, "status"),
      origin: readString(plugin, "origin"),
      toolNames: readStringArray(plugin.toolNames),
      hookNames: readStringArray(plugin.hookNames),
      gatewayMethods: readStringArray(plugin.gatewayMethods),
      services: readStringArray(plugin.services),
      commands: readStringArray(plugin.commands),
      cliCommands: readStringArray(plugin.cliCommands),
      channelIds: readStringArray(plugin.channelIds),
      providerIds: readStringArray(plugin.providerIds),
    }));
};

const probePairedCliRuntime = (): PairedCliProbeSummary => {
  const statusPayload = runOpenClawJson(["gateway", "call", "status", "--json"]);
  const toolsCatalogPayload = runOpenClawJson([
    "gateway",
    "call",
    "tools.catalog",
    "--json",
  ]);
  const configPayload = runOpenClawJson([
    "gateway",
    "call",
    "config.get",
    "--json",
    "--params",
    "{}",
  ]);
  const pluginsPayload = runOpenClawJson(["plugins", "list", "--json"]);

  const status = summarizePairedCliStatus(statusPayload);
  const toolsCatalog = summarizeToolsCatalog(toolsCatalogPayload);
  const configPlugins = summarizeConfigPlugins(configPayload);
  const loadedPlugins = summarizeLoadedPlugins(pluginsPayload);

  const loadedPluginIds = loadedPlugins.map((plugin) => plugin.id);
  const hasUnexpectedPluginGroup = toolsCatalog.pluginGroups.some((group) => {
    const pluginId = group.pluginId ?? group.id.replace(/^plugin:/, "");
    return !KNOWN_STOCK_PLUGIN_IDS.has(pluginId);
  });
  const hasUnexpectedLoadedPlugin = loadedPlugins.some(
    (plugin) => !KNOWN_STOCK_PLUGIN_IDS.has(plugin.id),
  );
  const hasCustomGatewaySurface = loadedPlugins.some(
    (plugin) =>
      plugin.gatewayMethods.length > 0 ||
      plugin.services.length > 0,
  );

  const runtimeInference =
    hasUnexpectedPluginGroup || hasUnexpectedLoadedPlugin || hasCustomGatewaySurface
      ? "Paired CLI sees at least one non-stock plugin/runtime surface beyond the baseline memory-core / telegram / camofox-browser setup. Inspect the listed plugin groups and loaded plugins before assuming the backend is missing."
      : `Paired CLI/runtime provenance only shows stock gateway surfaces plus ${loadedPluginIds.join(", ") || "no loaded plugins"}. No activity-specific or orchestrator plugin source, gateway method, or service is currently visible.`;

  return {
    status,
    toolsCatalog,
    configPlugins,
    loadedPlugins,
    runtimeInference,
  };
};

const probeGatewaySession = async ({
  gatewayUrl,
  token,
}: {
  gatewayUrl?: string;
  token: string;
}): Promise<GatewayProbeSummary> => {
  const url = normalizeControlGatewayUrl(gatewayUrl);

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;
    let rpcId = 0;
    let connectRequestId: string | null = null;
    let statusRequestId: string | null = null;
    let helloSummary: GatewayHelloSummary = {
      snapshotKeys: [],
      healthKeys: [],
      agentCount: 0,
      serviceTs: null,
    };
    let capabilities: GatewayCapabilitySnapshot = {
      methods: [],
      events: [],
    };

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      try {
        ws.close();
      } catch {
        // Ignore close errors during cleanup.
      }
    };

    const resolveSuccess = (status: GatewayStatusSummary) => {
      cleanup();
      resolve({
        ...capabilities,
        hello: helloSummary,
        status,
      });
    };

    const rejectWithError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const timeoutId = setTimeout(() => {
      rejectWithError(
        new Error("Timed out while probing gateway hello capabilities."),
      );
    }, 5_000);

    ws.onerror = () => {
      rejectWithError(
        new Error(`Failed to connect to ${url} for gateway capability probe.`),
      );
    };

    ws.onmessage = (event) => {
      const frame = JSON.parse(event.data.toString()) as {
        type?: string;
        event?: string;
        id?: string;
        ok?: boolean;
        error?: { message?: string } | string;
        payload?: {
          type?: string;
          features?: {
            methods?: string[];
            events?: string[];
          };
          snapshot?: {
            health?: {
              agents?: unknown[];
              ts?: number;
              [key: string]: unknown;
            };
            [key: string]: unknown;
          };
        };
      };

      if (frame.type === "event" && frame.event === "connect.challenge") {
        rpcId += 1;
        connectRequestId = `rpc-${rpcId}`;
        ws.send(
          JSON.stringify({
            type: "req",
            id: connectRequestId,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: GATEWAY_CONNECT_CLIENT_ID,
                instanceId: "openclaw-control-probe",
                version: "0.1.0",
                platform: "bun",
                mode: GATEWAY_CONNECT_CLIENT_MODE,
              },
              auth: { token },
              role: "operator",
              scopes: [GATEWAY_OPERATOR_READ_SCOPE],
            },
          }),
        );
        return;
      }

      if (frame.type !== "res") {
        return;
      }

      if (frame.id === connectRequestId) {
        if (!frame.ok) {
          const message =
            typeof frame.error === "string"
              ? frame.error
              : frame.error?.message ?? "Gateway capability probe failed.";
          rejectWithError(new Error(message));
          return;
        }

        if (frame.payload?.type === "hello-ok") {
          capabilities = {
            methods: Array.isArray(frame.payload.features?.methods)
              ? frame.payload.features.methods
              : [],
            events: Array.isArray(frame.payload.features?.events)
              ? frame.payload.features.events
              : [],
          };

          const snapshot =
            typeof frame.payload.snapshot === "object" && frame.payload.snapshot !== null
              ? frame.payload.snapshot
              : null;
          const health =
            snapshot &&
            typeof snapshot.health === "object" &&
            snapshot.health !== null
              ? snapshot.health
              : null;

          helloSummary = {
            snapshotKeys: snapshot ? Object.keys(snapshot) : [],
            healthKeys: health ? Object.keys(health) : [],
            agentCount: Array.isArray((health as { agents?: unknown[] } | null)?.agents)
              ? ((health as { agents: unknown[] }).agents.length ?? 0)
              : 0,
            serviceTs:
              typeof (health as { ts?: unknown } | null)?.ts === "number"
                ? ((health as { ts: number }).ts ?? null)
                : null,
          };
        }

        rpcId += 1;
        statusRequestId = `rpc-${rpcId}`;
        ws.send(
          JSON.stringify({
            type: "req",
            id: statusRequestId,
            method: "status",
            params: {},
          }),
        );
        return;
      }

      if (frame.id !== statusRequestId) {
        return;
      }

      if (!frame.ok) {
        const message =
          typeof frame.error === "string"
            ? frame.error
            : frame.error?.message ?? "Gateway status probe failed.";
        resolveSuccess({
          ok: false,
          error: message,
          sessionCount: null,
          recentSessionKeys: [],
        });
        return;
      }

      const statusSummary = summarizeStatusPayload(frame.payload);
      resolveSuccess({
        ok: true,
        error: null,
        sessionCount: statusSummary.sessionCount,
        recentSessionKeys: statusSummary.recentSessionKeys,
      });
    };
  });
};

const dispatchOrPreview = async ({
  envelope,
  summary,
}: {
  envelope: CommandEnvelope;
  summary: string;
}): Promise<void> => {
  const configuredOrchestratorUrl = resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL");
  const orchestratorBaseUrl = resolveOrchestratorBaseUrl();
  const hasLocalOrchestratorUrl = Boolean(
    normalizeControlConfigValue(configuredOrchestratorUrl),
  );
  const dispatchMethod = normalizeControlDispatchMethod(
    resolveConfigValue("OPENCLAW_COMMAND_METHOD"),
  );
  const commandParamKey = resolveConfigValue("OPENCLAW_COMMAND_PARAM_KEY");
  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  const token = resolveGatewayToken();

  console.log(`[openclaw-control] ${summary}`);
  console.log(JSON.stringify(envelope, null, 2));

  const confirmationRequirement =
    resolveDangerousCommandConfirmationRequirement(envelope);
  const hasDispatchTarget = hasLocalOrchestratorUrl || Boolean(dispatchMethod);
  if (
    confirmationRequirement &&
    !satisfiesDangerousCommandConfirmation({
      command: envelope,
      requirement: confirmationRequirement,
    })
  ) {
    const message =
      `[openclaw-control] Dangerous ${confirmationRequirement.commandType} command (${confirmationRequirement.reason}) requires --confirm ${JSON.stringify(confirmationRequirement.challenge)} before live dispatch.`;
    if (hasDispatchTarget) {
      fail(message);
    }

    console.log(`${message} Envelope preview only.`);
  } else if (confirmationRequirement && envelope.confirmation) {
    console.log(
      `[openclaw-control] confirmation verified: ${confirmationRequirement.challenge}`,
    );
  }

  if (hasLocalOrchestratorUrl) {
    const { token } = resolveLocalOrchestratorAuth();
    const responseBody = await requestLocalOrchestrator({
      url: buildOrchestratorCommandUrl(orchestratorBaseUrl),
      token,
      method: "POST",
      body: {
        command: envelope,
      },
    });

    if (isRecord(responseBody) && isRecord(responseBody.receipt)) {
      const receiptStatus = readString(responseBody.receipt, "status");
      const commandId = readString(responseBody.receipt, "commandId");
      if (receiptStatus) {
        console.log(
          `[openclaw-control] receipt.status=${receiptStatus}${commandId ? ` commandId=${commandId}` : ""}`,
        );
      }
    }

    console.log(
      `[openclaw-control] Dispatched to local authoritative orchestrator ${orchestratorBaseUrl}.`,
    );
    console.log(JSON.stringify(responseBody, null, 2));
    process.exit(0);
  }

  let capabilities: GatewayCapabilitySnapshot | null = null;
  if (token) {
    try {
      const probe = await probeGatewaySession({ gatewayUrl, token });
      capabilities = {
        methods: probe.methods,
        events: probe.events,
      };
      const contract = summarizeGatewayOrchestrationContract({
        capabilities,
        configuredDispatchMethod: dispatchMethod,
      });

      if (contract.note) {
        console.log(`[openclaw-control] ${contract.note}`);
      }

      if (!probe.status.ok && probe.status.error) {
        console.log(
          `[openclaw-control] Raw websocket status probe is still blocked: ${probe.status.error}`,
        );
      }

      if (dispatchMethod && contract.status !== "available") {
        fail(
          `[openclaw-control] Refusing to dispatch with unverified contract. ${contract.note ?? "The live gateway did not confirm the configured dispatch method."}`,
        );
      }
    } catch (error) {
      const message = (error as Error).message;
      if (dispatchMethod) {
        fail(
          `[openclaw-control] Refusing to dispatch until live gateway hello confirms the contract. ${message}`,
        );
      }

      console.log(
        `[openclaw-control] Unable to verify live gateway capabilities: ${message}`,
      );
    }
  }

  if (!dispatchMethod) {
    console.log(
      "[openclaw-control] No OPENCLAW_COMMAND_METHOD configured. Envelope preview only.",
    );
    process.exit(0);
  }

  if (!token) {
    fail(
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
    );
  }

  const args = buildGatewayDispatchCommandArgs({
    dispatchMethod,
    commandEnvelope: envelope,
    gatewayUrl,
    token,
    timeoutMs: 15_000,
    commandParamKey,
  });

  return runOpenClaw(args);
};

const parsePayloadJson = (source: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return fail("Payload JSON must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    return fail(`Invalid payload JSON: ${(error as Error).message}`);
  }
};

const parseLongOptions = (
  rawArgs: string[],
): {
  positional: string[];
  options: Record<string, string>;
} => {
  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    const optionName = value.slice(2);
    const nextValue = rawArgs[index + 1];
    if (!optionName || !nextValue || nextValue.startsWith("--")) {
      fail(`Missing value for option ${value}.\n\n${USAGE}`);
    }

    options[optionName] = nextValue;
    index += 1;
  }

  return { positional, options };
};

const readCommandConfirmationOption = (
  options: Record<string, string>,
) => {
  const challenge = normalizeControlConfigValue(options.confirm);
  return challenge ? buildCommandConfirmation(challenge) : undefined;
};

const readOptionInteger = (
  options: Record<string, string>,
  key: string,
): number | undefined => {
  const rawValue = options[key];
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`--${key} must be a non-negative integer.`);
  }

  return parsed;
};

const resolveLocalOrchestratorAuth = (): {
  baseUrl: string;
  token: string;
} => {
  const resolvedToken = resolveOrchestratorToken();
  if (!resolvedToken) {
    return fail(
      "Missing local orchestrator token. Set OPENCLAW_ORCHESTRATOR_TOKEN or OPENCLAW_GATEWAY_TOKEN.",
    );
  }

  return {
    baseUrl: resolveOrchestratorBaseUrl(),
    token: resolvedToken,
  };
};

const probeLocalOrchestrator = async (
  activityRunId: string,
): Promise<LocalOrchestratorProbeSummary> => {
  const baseUrl = resolveOrchestratorBaseUrl();
  const token = resolveOrchestratorToken();
  const url = buildOrchestratorSnapshotUrl({
    baseUrl,
    activityRunId,
  });

  if (!token) {
    return {
      baseUrl,
      activityRunId,
      status: "auth-missing",
      httpStatus: null,
      note:
        `OPENCLAW_ORCHESTRATOR_TOKEN is missing, so molt-claw's authoritative snapshot cannot be verified at ${baseUrl}.`,
      snapshotKeys: [],
      templateId: null,
      currentStageId: null,
      snapshotResponse: null,
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      return {
        baseUrl,
        activityRunId,
        status: response.status === 404 ? "wrong-service" : "http-error",
        httpStatus: response.status,
        note: buildLocalOrchestratorFailureNote({
          baseUrl,
          activityRunId,
          httpStatus: response.status,
          reason:
            response.status === 404
              ? "The URL appears to point at another OpenClaw service or proxy instead of the authoritative orchestrator."
              : formatOrchestratorError(
                  responseBody,
                  "Authoritative snapshot query failed.",
                ),
        }),
        snapshotKeys: [],
        templateId: null,
        currentStageId: null,
        snapshotResponse: null,
      };
    }

    if (!isOrchestratorSnapshotResponse(responseBody)) {
      return {
        baseUrl,
        activityRunId,
        status: "wrong-service",
        httpStatus: response.status,
        note: buildLocalOrchestratorFailureNote({
          baseUrl,
          activityRunId,
          httpStatus: response.status,
          reason:
            "The endpoint returned JSON, but it does not match the authoritative orchestrator snapshot shape.",
        }),
        snapshotKeys: [],
        templateId: null,
        currentStageId: null,
        snapshotResponse: null,
      };
    }

    return {
      baseUrl,
      activityRunId,
      status: "available",
      httpStatus: response.status,
      note: `Authoritative orchestrator snapshot is available at ${baseUrl} for ${activityRunId}.`,
      snapshotKeys: Object.keys(responseBody.snapshot),
      templateId: responseBody.snapshot.activityRun?.templateId ?? null,
      currentStageId: responseBody.snapshot.activityRun?.currentStageId ?? null,
      snapshotResponse: responseBody,
    };
  } catch (error) {
    return {
      baseUrl,
      activityRunId,
      status: "unreachable",
      httpStatus: null,
      note:
        `Unable to reach molt-claw's authoritative orchestrator at ${baseUrl}: ${(error as Error).message}. ` +
        "Start this repo's scripts/openclaw-orchestrator.ts on a free port and point OPENCLAW_ORCHESTRATOR_URL at that server.",
      snapshotKeys: [],
      templateId: null,
      currentStageId: null,
      snapshotResponse: null,
    };
  }
};

const requireLocalOrchestrator = async (
  activityRunId: string,
): Promise<LocalOrchestratorProbeSummary> => {
  const probe = await probeLocalOrchestrator(activityRunId);
  if (probe.status !== "available" || !probe.snapshotResponse) {
    fail(`[openclaw-control] ${probe.note}`);
  }
  return probe;
};

const resolveAgentCommandActivityContext = async ({
  activityRunId,
  explicitActivityPackageId,
}: {
  activityRunId?: string;
  explicitActivityPackageId?: string;
}): Promise<AgentCommandActivityContext> => {
  const normalizedExplicitActivityPackageId = explicitActivityPackageId?.trim();
  if (normalizedExplicitActivityPackageId) {
    const roomCatalog = tryBuildBootstrapRoomCatalog(normalizedExplicitActivityPackageId);
    if (!roomCatalog) {
      fail(
        `[openclaw-control] Unknown activity package ${normalizedExplicitActivityPackageId}.`,
      );
    }

    return {
      activityPackageId: normalizedExplicitActivityPackageId,
      roomCatalog,
      note: `Room aliases resolved against bootstrap seed for activity package ${normalizedExplicitActivityPackageId}.`,
    };
  }

  const configuredOrchestratorUrl = resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL");
  if (!normalizeControlConfigValue(configuredOrchestratorUrl)) {
    return {
      activityPackageId: null,
      roomCatalog: null,
      note: null,
    };
  }

  const orchestratorToken = resolveOrchestratorToken();
  if (!orchestratorToken) {
    return {
      activityPackageId: null,
      roomCatalog: null,
      note:
        "Authoritative orchestrator is configured, but no token is available for activity-scoped room resolution.",
    };
  }

  try {
    const probe = await probeLocalOrchestrator(
      activityRunId ?? resolveLocalPlatformBootstrapConfig().defaultActivityRunId,
    );
    if (probe.status !== "available" || !probe.snapshotResponse) {
      return {
        activityPackageId: null,
        roomCatalog: null,
        note: probe.note,
      };
    }

    const snapshot = probe.snapshotResponse.snapshot;
    const activityRun =
      snapshot && isRecord(snapshot.activityRun) ? snapshot.activityRun : null;
    const templateId = readString(activityRun ?? undefined, "templateId");
    const activityPackageId = tryResolveActivityPackageId({
      templateId,
    });
    const world =
      snapshot && isWorldProjection(snapshot.world) ? snapshot.world : null;

    if (world) {
      return {
        activityPackageId,
        roomCatalog: buildWorldRoomCatalog({
          world,
          activityPackageId,
        }),
        note: activityPackageId
          ? `Room aliases resolved against authoritative activity ${activityPackageId}.`
          : "Room aliases resolved against the authoritative world snapshot.",
      };
    }

    return {
      activityPackageId,
      roomCatalog: null,
      note: activityPackageId
        ? `Authoritative snapshot is reachable for ${activityPackageId}, but authority world is not available yet.`
        : "Authoritative snapshot is reachable, but it does not expose enough room metadata yet.",
    };
  } catch (error) {
    return {
      activityPackageId: null,
      roomCatalog: null,
      note: `Unable to read authoritative snapshot for room resolution: ${(error as Error).message}`,
    };
  }
};

const runLocalOrchestratorQuery = async ({
  label,
  url,
  activityRunId,
  verifiedSnapshotResponse,
}: {
  label: string;
  url: string;
  activityRunId: string;
  verifiedSnapshotResponse?: OrchestratorSnapshotResponse;
}): Promise<void> => {
  await requireLocalOrchestrator(activityRunId);
  const { token } = resolveLocalOrchestratorAuth();
  console.log(`[openclaw-control] ${label}`);
  if (verifiedSnapshotResponse) {
    return printJsonAndExit(verifiedSnapshotResponse);
  }
  const responseBody = await requestLocalOrchestrator({
    url,
    token,
  });
  return printJsonAndExit(responseBody);
};

const loadLocalOrchestratorJson = async <T>(url: string): Promise<T> => {
  const { token } = resolveLocalOrchestratorAuth();
  return (await requestLocalOrchestrator({
    url,
    token,
  })) as T;
};

const readPositiveOptionNumber = (
  options: Record<string, string>,
  key: string,
): number | undefined => {
  const rawValue = options[key];
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`--${key} must be a positive number.`);
  }

  return parsed;
};

const clearTerminalScreen = (): void => {
  process.stdout.write("\x1bc");
};

const formatNowLabel = (): string => {
  const now = new Date();
  return [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join(":");
};

const renderAsciiOverview = async ({
  activityRunId,
  limit,
}: {
  activityRunId: string;
  limit: number;
}): Promise<string> => {
  const verified = await requireLocalOrchestrator(activityRunId);
  const { baseUrl, token } = resolveLocalOrchestratorAuth();
  const eventsResponse = await loadLocalOrchestratorJson<OrchestratorEventPage>(
    buildOrchestratorEventsUrl({
      baseUrl,
      query: {
        activityRunId,
        limit,
      },
    }),
  );
  const replayResponse = (await requestLocalOrchestrator({
    url: buildOrchestratorReplayUrl({
      baseUrl,
      query: {
        activityRunId,
        limit: Math.max(limit * 4, 40),
      },
    }),
    token,
  })) as OrchestratorEventPage;

  const snapshotResponse = verified.snapshotResponse;
  if (!snapshotResponse) {
    return fail(`[openclaw-control] ${verified.note}`);
  }

  return buildOpenClawAsciiOverview({
    snapshotResponse,
    eventsPage: eventsResponse,
    replayPage: replayResponse,
    eventLimit: limit,
  });
};

const runAsciiOverview = async ({
  activityRunId,
  limit,
  watchSeconds,
}: {
  activityRunId: string;
  limit: number;
  watchSeconds?: number;
}): Promise<never> => {
  const watchMs =
    watchSeconds === undefined ? null : Math.max(250, Math.round(watchSeconds * 1000));

  if (watchMs === null) {
    console.log(
      await renderAsciiOverview({
        activityRunId,
        limit,
      }),
    );
    process.exit(0);
  }

  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) {
      return;
    }
    stopping = true;
    process.stdout.write("\n[openclaw-control] ascii watch stopped.\n");
    process.exit(0);
  });

  while (true) {
    const overview = await renderAsciiOverview({
      activityRunId,
      limit,
    });
    clearTerminalScreen();
    console.log(
      `[openclaw-control] ascii watch ${activityRunId} refresh=${(
        watchMs / 1000
      ).toFixed(2)}s updated=${formatNowLabel()}\n`,
    );
    console.log(overview);
    await Bun.sleep(watchMs);
  }
};

const parseEventQueryArgs = (
  commandName: "events" | "replay" | "scores",
  rawArgs: string[],
): {
  activityRunId: string;
  query: OrchestratorEventQuery;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId] = positional;
  if (!activityRunId) {
    fail(USAGE);
  }

  const query: OrchestratorEventQuery = {
    activityRunId,
    afterSequence: readOptionInteger(options, "after-sequence"),
    fromSequence: readOptionInteger(options, "from-sequence"),
    toSequence: readOptionInteger(options, "to-sequence"),
    limit: readOptionInteger(options, "limit"),
  };

  if (
    query.afterSequence !== undefined &&
    query.fromSequence !== undefined
  ) {
    fail(
      `${commandName} accepts --after-sequence or --from-sequence, not both.`,
    );
  }

  return {
    activityRunId,
    query,
  };
};

const parseSubmissionCommandArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  submissionId: string;
  data: Record<string, unknown>;
} => {
  const { positional } = parseLongOptions(rawArgs);
  const [activityRunId, submissionId, payloadJson] = positional;
  if (!activityRunId || !submissionId || !payloadJson) {
    fail(USAGE);
  }

  return {
    activityRunId,
    submissionId,
    data: parsePayloadJson(payloadJson),
  };
};

const parseAnnotationsJson = (
  source: string,
): Record<string, string> => {
  const parsed = parsePayloadJson(source);
  return Object.entries(parsed).reduce<Record<string, string>>(
    (result, [key, value]) => {
      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value.trim();
      }
      return result;
    },
    {},
  );
};

const readLegacyScoreCompatAnnotations = (
  options: Record<string, string>,
): {
  annotations: Record<string, string>;
  usingLegacyCompatFlags: boolean;
} => {
  const annotations: Record<string, string> = {};
  let usingLegacyCompatFlags = false;

  for (const option of legacyScoreCompatOptions) {
    const providedValue = option.optionNames
      .map((optionName) => options[optionName]?.trim())
      .find((value) => value !== undefined);

    if (providedValue === undefined) {
      continue;
    }

    usingLegacyCompatFlags = true;
    if (!providedValue) {
      fail(`submit-score requires --${option.optionNames[0]} <text>.`);
    }

    annotations[option.canonicalKey] = providedValue;
  }

  return {
    annotations,
    usingLegacyCompatFlags,
  };
};

const parseSubmitScoreArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  scorePayload: SubmitScorePayload;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, submissionId, scoreInput] = positional;
  if (!activityRunId || !submissionId || !scoreInput) {
    fail(USAGE);
  }

  const score = Number.parseInt(scoreInput, 10);
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    fail("submit-score requires <score-1..10>.");
  }

  const reason = options.reason?.trim();
  const annotationsFromJson = options["annotations-json"]?.trim()
    ? parseAnnotationsJson(options["annotations-json"])
    : {};
  const {
    annotations: annotationsFromCompatFlags,
    usingLegacyCompatFlags,
  } = readLegacyScoreCompatAnnotations(options);

  if (!reason) {
    fail("submit-score requires --reason <text>.");
  }

  const annotations = {
    ...annotationsFromJson,
    ...annotationsFromCompatFlags,
  };

  if (Object.keys(annotations).length === 0) {
    fail(
      usingLegacyCompatFlags
        ? "submit-score requires non-empty score annotation values."
        : "submit-score requires score annotations. Use --annotations-json '{\"key\":\"value\"}' or the legacy activity compatibility flags.",
    );
  }

  return {
    activityRunId,
    scorePayload: {
      submissionId,
      score,
      reason,
      annotations,
    },
  };
};

const parseAudienceScopeOption = (
  value: string | undefined,
): "room" | "team" | "global" | undefined => {
  const normalized = normalizeControlConfigValue(value);
  if (
    normalized === undefined ||
    normalized === "room" ||
    normalized === "team" ||
    normalized === "global"
  ) {
    return normalized;
  }

  fail("--audience-scope must be room, team, or global.");
};

const readPositiveNumericOption = (
  options: Record<string, string>,
  key: string,
): number | undefined => {
  const rawValue = options[key];
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`--${key} must be a positive number.`);
  }

  return parsed;
};

const parseTalkArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  message: string;
  roomId?: string;
  targetEntityId?: string;
  audienceScope?: "room" | "team" | "global";
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, ...messageParts] = positional;
  const message = messageParts.join(" ").trim();
  if (!activityRunId || !message) {
    fail(USAGE);
  }

  return {
    activityRunId,
    message,
    roomId: normalizeControlConfigValue(options["room-id"]),
    targetEntityId: normalizeControlConfigValue(options["target-entity-id"]),
    audienceScope: parseAudienceScopeOption(options["audience-scope"]),
  };
};

const parseBroadcastArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  message: string;
  roomId?: string;
  teamId?: string;
  audienceScope?: "room" | "team" | "global";
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, ...messageParts] = positional;
  const message = messageParts.join(" ").trim();
  if (!activityRunId || !message) {
    fail(USAGE);
  }

  return {
    activityRunId,
    message,
    roomId: normalizeControlConfigValue(options["room-id"]),
    teamId: normalizeControlConfigValue(options["team-id"]),
    audienceScope: parseAudienceScopeOption(options["audience-scope"]),
  };
};

const parseReactionArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  reaction: string;
  note?: string;
  roomId?: string;
  targetEntityId?: string;
  targetTeamId?: string;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, reaction, ...noteParts] = positional;
  if (!activityRunId || !reaction) {
    fail(USAGE);
  }

  const noteFromPositional = noteParts.join(" ").trim();
  return {
    activityRunId,
    reaction,
    note:
      normalizeControlConfigValue(options.note) ??
      (noteFromPositional || undefined),
    roomId: normalizeControlConfigValue(options["room-id"]),
    targetEntityId: normalizeControlConfigValue(options["target-entity-id"]),
    targetTeamId: normalizeControlConfigValue(options["target-team-id"]),
  };
};

const parseBetArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  targetType: "team" | "entity" | "submission";
  targetId: string;
  roomId?: string;
  amount?: number;
  odds?: number;
  stance?: string;
  note?: string;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, targetTypeInput, targetId] = positional;
  if (!activityRunId || !targetTypeInput || !targetId) {
    fail(USAGE);
  }

  const targetType = normalizeControlConfigValue(targetTypeInput);
  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    fail("bet requires <team|entity|submission> as the target type.");
  }

  return {
    activityRunId,
    targetType: targetType as "team" | "entity" | "submission",
    targetId,
    roomId: normalizeControlConfigValue(options["room-id"]),
    amount: readOptionInteger(options, "amount"),
    odds: readPositiveNumericOption(options, "odds"),
    stance: normalizeControlConfigValue(options.stance),
    note: normalizeControlConfigValue(options.note),
  };
};

const parseVoteArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  targetType: "team" | "entity" | "submission";
  targetId: string;
  roomId?: string;
  value?: number;
  note?: string;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, targetTypeInput, targetId] = positional;
  if (!activityRunId || !targetTypeInput || !targetId) {
    fail(USAGE);
  }

  const targetType = normalizeControlConfigValue(targetTypeInput);
  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    fail("vote requires <team|entity|submission> as the target type.");
  }

  return {
    activityRunId,
    targetType: targetType as "team" | "entity" | "submission",
    targetId,
    roomId: normalizeControlConfigValue(options["room-id"]),
    value: readOptionInteger(options, "value"),
    note: normalizeControlConfigValue(options.note),
  };
};

const parseFinishArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  settlementMode: "winner" | "push";
  winningTargetType?: "team" | "entity" | "submission";
  winningTargetId?: string;
  note?: string;
  confirmation?: CommandEnvelope["confirmation"];
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, targetTypeInput, targetId] = positional;
  if (!activityRunId || !targetTypeInput) {
    fail(USAGE);
  }

  const normalizedTargetType = normalizeControlConfigValue(targetTypeInput);
  if (normalizedTargetType === "push") {
    return {
      activityRunId,
      settlementMode: "push",
      note: normalizeControlConfigValue(options.note),
      confirmation: readCommandConfirmationOption(options),
    };
  }

  if (
    normalizedTargetType !== "team" &&
    normalizedTargetType !== "entity" &&
    normalizedTargetType !== "submission"
  ) {
    fail("finish requires <team|entity|submission|push> as the settlement target.");
  }

  if (!targetId) {
    fail("finish requires a target id unless the settlement mode is push.");
  }

  return {
    activityRunId,
    settlementMode: "winner",
    winningTargetType: normalizedTargetType as "team" | "entity" | "submission",
    winningTargetId: targetId,
    note: normalizeControlConfigValue(options.note),
    confirmation: readCommandConfirmationOption(options),
  };
};

const resolveActorId = (): string =>
  resolveConfigValue("OPENCLAW_COMMAND_ACTOR_ID") ?? "molt-claw";

const runProbe = async (): Promise<never> => {
  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  const resolvedToken = resolveGatewayToken();
  const activityRunId = resolveLocalPlatformBootstrapConfig().defaultActivityRunId;
  const dispatchMethod = normalizeControlDispatchMethod(
    resolveConfigValue("OPENCLAW_COMMAND_METHOD"),
  );
  const gatewayProbe = resolvedToken
    ? await probeGatewaySession({
        gatewayUrl,
        token: resolvedToken,
      })
        .then((probe) => ({
          ok: true as const,
          methods: probe.methods,
          events: probe.events,
          hello: probe.hello,
          rawStatus: probe.status,
          note: null,
        }))
        .catch((error) => ({
          ok: false as const,
          methods: [] as string[],
          events: [] as string[],
          hello: null,
          rawStatus: null,
          note: (error as Error).message,
        }))
    : {
        ok: false as const,
        methods: [] as string[],
        events: [] as string[],
        hello: null,
        rawStatus: null,
        note:
          "Missing OpenClaw gateway token. Set OPENCLAW_GATEWAY_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
      };
  const contract = summarizeGatewayOrchestrationContract({
    capabilities: {
      methods: gatewayProbe.methods,
      events: gatewayProbe.events,
    },
    configuredDispatchMethod: dispatchMethod,
  });
  let pairedCli: PairedCliProbeSummary | null = null;
  let pairedCliError: string | null = null;
  try {
    pairedCli = probePairedCliRuntime();
  } catch (error) {
    pairedCliError = (error as Error).message;
  }
  const orchestrator = await probeLocalOrchestrator(activityRunId);

  console.log(
    JSON.stringify(
      {
        gatewayUrl: normalizeControlGatewayUrl(gatewayUrl),
        orchestrationContract: contract,
        configuredDispatchMethod: dispatchMethod ?? null,
        gatewayProbe: gatewayProbe.ok
          ? {
              ok: true,
              methods: gatewayProbe.methods,
              events: gatewayProbe.events,
              hello: gatewayProbe.hello,
              rawStatus: gatewayProbe.rawStatus,
            }
          : {
              ok: false,
              note: gatewayProbe.note,
            },
        localOrchestrator: {
          baseUrl: orchestrator.baseUrl,
          activityRunId: orchestrator.activityRunId,
          status: orchestrator.status,
          httpStatus: orchestrator.httpStatus,
          note: orchestrator.note,
          snapshotKeys: orchestrator.snapshotKeys,
          templateId: orchestrator.templateId,
          currentStageId: orchestrator.currentStageId,
        },
        pairedCli,
        pairedCliError,
      },
      null,
      2,
    ),
  );
  process.exit(0);
};

const resolveActorRole = (): ControlActorRole => {
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
  return "host";
};

const [command, ...args] = process.argv.slice(2);

if (!command) {
  fail(USAGE);
}

const normalizedCommand = command as CommandName;

if (normalizedCommand === "probe") {
  await runProbe();
}

if (normalizedCommand === "move" || normalizedCommand === "say") {
  const { positional, options } = parseLongOptions(args);
  const [agentId, room, ...messageParts] = positional;
  if (!agentId || !room) {
    fail(USAGE);
  }

  const activityContext = await resolveAgentCommandActivityContext({
    activityRunId: options["activity-run-id"]?.trim(),
    explicitActivityPackageId: options["activity-package-id"]?.trim(),
  });

  if (activityContext.note) {
    console.log(`[openclaw-control] ${activityContext.note}`);
  }

  if (!activityContext.roomCatalog) {
    fail(
      "[openclaw-control] move/say room aliases are now activity-scoped. Configure OPENCLAW_ORCHESTRATOR_URL so the CLI can read snapshot.world, or pass --activity-package-id <id> for an explicit bootstrap/dev alias fallback.",
    );
  }

  const roomResolutionOptions = {
    roomCatalog: activityContext.roomCatalog,
  } as const;

  const message =
    normalizedCommand === "move"
      ? buildMoveMessage(
          room,
          activityContext.activityPackageId ?? undefined,
          roomResolutionOptions,
        )
      : messageParts.join(" ").trim();

  if (!message) {
    fail(`A message is required for "${normalizedCommand}".\n\n${USAGE}`);
  }

  const token = resolveGatewayToken();
  if (!token) {
    fail(
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
    );
  }

  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  const roomId = resolveControlRoomId(
    room,
    activityContext.activityPackageId ?? undefined,
    roomResolutionOptions,
  );
  const idempotencyKey = `roomctl-${agentId}-${roomId}-${Date.now()}`;

  const openClawArgs = buildGatewayAgentCallArgs({
    agentId,
    room,
    message,
    timeoutSeconds: 120,
    gatewayUrl,
    token,
    idempotencyKey,
    activityPackageId: activityContext.activityPackageId,
    roomCatalog: activityContext.roomCatalog,
  });

  console.log(
    `[openclaw-control] ${normalizedCommand} ${agentId} -> ${roomId} (${message})`,
  );
  runOpenClaw(openClawArgs);
}

if (normalizedCommand === "talk") {
  const talk = parseTalkArgs(args);
  await dispatchOrPreview({
    envelope: buildTalkEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: talk.activityRunId,
      message: talk.message,
      roomId: talk.roomId,
      targetEntityId: talk.targetEntityId,
      audienceScope: talk.audienceScope,
      idempotencyKey: `talk-${talk.activityRunId}-${Date.now()}`,
    }),
    summary: `talk ${talk.activityRunId} / ${talk.roomId ?? "auto-room"}`,
  });
}

if (normalizedCommand === "broadcast") {
  const broadcast = parseBroadcastArgs(args);
  await dispatchOrPreview({
    envelope: buildBroadcastEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: broadcast.activityRunId,
      message: broadcast.message,
      roomId: broadcast.roomId,
      teamId: broadcast.teamId,
      audienceScope: broadcast.audienceScope,
      idempotencyKey: `broadcast-${broadcast.activityRunId}-${Date.now()}`,
    }),
    summary:
      `broadcast ${broadcast.activityRunId} / ` +
      `${broadcast.teamId ?? broadcast.roomId ?? broadcast.audienceScope ?? "global"}`,
  });
}

if (normalizedCommand === "reaction") {
  const reaction = parseReactionArgs(args);
  await dispatchOrPreview({
    envelope: buildReactionEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: reaction.activityRunId,
      reaction: reaction.reaction,
      roomId: reaction.roomId,
      targetEntityId: reaction.targetEntityId,
      targetTeamId: reaction.targetTeamId,
      note: reaction.note,
      idempotencyKey: `reaction-${reaction.activityRunId}-${Date.now()}`,
    }),
    summary:
      `reaction ${reaction.activityRunId} / ` +
      `${reaction.targetEntityId ?? reaction.targetTeamId ?? reaction.roomId ?? "stage"}`,
  });
}

if (normalizedCommand === "bet") {
  const bet = parseBetArgs(args);
  await dispatchOrPreview({
    envelope: buildBetEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: bet.activityRunId,
      targetType: bet.targetType,
      targetId: bet.targetId,
      roomId: bet.roomId,
      amount: bet.amount,
      odds: bet.odds,
      stance: bet.stance,
      note: bet.note,
      idempotencyKey: `bet-${bet.activityRunId}-${bet.targetType}-${bet.targetId}-${Date.now()}`,
    }),
    summary: `bet ${bet.activityRunId} / ${bet.targetType}:${bet.targetId}`,
  });
}

if (normalizedCommand === "vote") {
  const vote = parseVoteArgs(args);
  await dispatchOrPreview({
    envelope: buildVoteEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: vote.activityRunId,
      targetType: vote.targetType,
      targetId: vote.targetId,
      roomId: vote.roomId,
      value: vote.value,
      note: vote.note,
      idempotencyKey: `vote-${vote.activityRunId}-${vote.targetType}-${vote.targetId}-${Date.now()}`,
    }),
    summary: `vote ${vote.activityRunId} / ${vote.targetType}:${vote.targetId}`,
  });
}

if (normalizedCommand === "stage") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, targetStageId] = positional;
  if (!activityRunId || !targetStageId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildTransitionStageEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      targetStageId,
      idempotencyKey: `stage-${activityRunId}-${targetStageId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `transition_stage ${activityRunId} -> ${targetStageId}`,
  });
}

if (normalizedCommand === "finish") {
  const finish = parseFinishArgs(args);
  await dispatchOrPreview({
    envelope: buildFinishActivityEnvelope({
      actorId: resolveActorId(),
      activityRunId: finish.activityRunId,
      settlementMode: finish.settlementMode,
      winningTargetType: finish.winningTargetType,
      winningTargetId: finish.winningTargetId,
      note: finish.note,
      idempotencyKey: `finish-${finish.activityRunId}-${Date.now()}`,
      confirmation: finish.confirmation,
    }),
    summary:
      finish.settlementMode === "push"
        ? `finish ${finish.activityRunId} / push`
        : `finish ${finish.activityRunId} / ${finish.winningTargetType}:${finish.winningTargetId}`,
  });
}

if (normalizedCommand === "start-timer") {
  const [activityRunId, stageId, durationSecInput] = args;
  if (!activityRunId || !stageId || !durationSecInput) {
    fail(USAGE);
  }

  const durationSec = Number.parseInt(durationSecInput, 10);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    fail("Duration must be a positive integer in seconds.");
  }

  await dispatchOrPreview({
    envelope: buildStartTimerEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      stageId,
      durationSec,
      idempotencyKey: `timer-${activityRunId}-${stageId}-${Date.now()}`,
    }),
    summary: `start_timer ${activityRunId} / ${stageId} (${durationSec}s)`,
  });
}

if (normalizedCommand === "open-submission") {
  const [activityRunId, submissionId] = args;
  if (!activityRunId || !submissionId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildOpenSubmissionEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId,
      idempotencyKey: `open-${activityRunId}-${submissionId}-${Date.now()}`,
    }),
    summary: `open_submission ${activityRunId} / ${submissionId}`,
  });
}

if (normalizedCommand === "submit") {
  const { activityRunId, submissionId, data } = parseSubmissionCommandArgs(args);
  await dispatchOrPreview({
    envelope: buildSubmitEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId,
      submissionId,
      data,
      idempotencyKey: `submit-${activityRunId}-${submissionId}-${Date.now()}`,
    }),
    summary: `submit ${activityRunId} / ${submissionId}`,
  });
}

if (normalizedCommand === "update-submission") {
  const { activityRunId, submissionId, data } = parseSubmissionCommandArgs(args);
  await dispatchOrPreview({
    envelope: buildUpdateSubmissionEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId,
      submissionId,
      data,
      idempotencyKey: `update-submission-${activityRunId}-${submissionId}-${Date.now()}`,
    }),
    summary: `update_submission ${activityRunId} / ${submissionId}`,
  });
}

if (normalizedCommand === "lock-submission") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, submissionId] = positional;
  if (!activityRunId || !submissionId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildLockSubmissionEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId,
      idempotencyKey: `lock-${activityRunId}-${submissionId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `lock_submission ${activityRunId} / ${submissionId}`,
  });
}

if (normalizedCommand === "submit-score") {
  const { activityRunId, scorePayload } = parseSubmitScoreArgs(args);
  await dispatchOrPreview({
    envelope: buildSubmitScoreEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId: scorePayload.submissionId,
      score: scorePayload.score,
      reason: scorePayload.reason,
      annotations: scorePayload.annotations,
      idempotencyKey: `submit-score-${activityRunId}-${scorePayload.submissionId}-${Date.now()}`,
    }),
    summary: `submit_score ${activityRunId} / ${scorePayload.submissionId} (${scorePayload.score}/10)`,
  });
}

if (normalizedCommand === "grant-award") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, awardId, entityId, label, ...reasonParts] = positional;
  if (!activityRunId || !awardId || !entityId) {
    fail(USAGE);
  }

  const reason = reasonParts.join(" ").trim() || undefined;
  await dispatchOrPreview({
    envelope: buildGrantAwardEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      awardId,
      entityId,
      label,
      reason,
      idempotencyKey: `award-${activityRunId}-${awardId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `grant_award ${activityRunId} / ${awardId} -> ${entityId}`,
  });
}

if (normalizedCommand === "draw") {
  const [activityRunId, entityId, drawDataJson] = args;
  if (!activityRunId || !entityId || !drawDataJson) {
    fail(USAGE);
  }

  const drawData = parsePayloadJson(drawDataJson);
  await dispatchOrPreview({
    envelope: buildCommandEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole() === "host" ? "agent" : resolveActorRole(),
      activityRunId,
      type: "draw",
      payload: { entityId, data: drawData },
      idempotencyKey: `draw-${activityRunId}-${entityId}-${Date.now()}`,
    }),
    summary: `draw ${activityRunId} / ${entityId}`,
  });
}

if (normalizedCommand === "move-entity") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, entityId, toRoomId, kind] = positional;
  if (!activityRunId || !entityId || !toRoomId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildMoveEntityEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      entityId,
      toRoomId,
      kind: kind || undefined,
      idempotencyKey: `move-entity-${activityRunId}-${entityId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `move_entity ${activityRunId} / ${entityId} -> ${toRoomId}`,
  });
}

if (normalizedCommand === "assign-team") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, teamId] = positional;
  if (!activityRunId || !teamId) {
    fail(USAGE);
  }

  const membersRaw = normalizeControlConfigValue(options.members);
  const memberIds = membersRaw ? membersRaw.split(",").map((id) => id.trim()).filter(Boolean) : undefined;
  const roomId = normalizeControlConfigValue(options["room-id"]);

  await dispatchOrPreview({
    envelope: buildAssignTeamEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      teamId,
      memberIds,
      roomId: roomId || undefined,
      idempotencyKey: `assign-team-${activityRunId}-${teamId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `assign_team ${activityRunId} / ${teamId}${memberIds ? ` (${memberIds.length} members)` : ""}`,
  });
}

if (normalizedCommand === "ascii") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId] = positional;
  if (!activityRunId) {
    fail(USAGE);
  }

  const limit = readOptionInteger(options, "limit") ?? 12;
  const watchSeconds = readPositiveOptionNumber(options, "watch");

  await runAsciiOverview({
    activityRunId,
    limit,
    watchSeconds,
  });
}

if (normalizedCommand === "snapshot") {
  const [activityRunIdArgument] = args;
  const activityRunId =
    activityRunIdArgument ?? resolveLocalPlatformBootstrapConfig().defaultActivityRunId;
  const verified = await requireLocalOrchestrator(activityRunId);
  const snapshotResponse = verified.snapshotResponse;
  if (!snapshotResponse) {
    fail(`[openclaw-control] ${verified.note}`);
  }

  await runLocalOrchestratorQuery({
    label: `snapshot ${activityRunId} via local authoritative orchestrator`,
    activityRunId,
    url: buildOrchestratorSnapshotUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      activityRunId,
    }),
    verifiedSnapshotResponse: snapshotResponse ?? undefined,
  });
}

if (normalizedCommand === "events") {
  const { activityRunId, query } = parseEventQueryArgs("events", args);
  await runLocalOrchestratorQuery({
    label: `events ${activityRunId} via local authoritative orchestrator`,
    activityRunId,
    url: buildOrchestratorEventsUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      query,
    }),
  });
}

if (normalizedCommand === "scores") {
  const { activityRunId, query } = parseEventQueryArgs("scores", args);
  await runLocalOrchestratorQuery({
    label: `scores ${activityRunId} via local authoritative orchestrator`,
    activityRunId,
    url: buildOrchestratorScoresUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      query,
    }),
  });
}

if (normalizedCommand === "replay") {
  const { activityRunId, query } = parseEventQueryArgs("replay", args);
  await runLocalOrchestratorQuery({
    label: `replay ${activityRunId} via local authoritative orchestrator`,
    activityRunId,
    url: buildOrchestratorReplayUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      query,
    }),
  });
}

if (normalizedCommand === "audit") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunIdArgument] = positional;
  const activityRunId =
    activityRunIdArgument ?? resolveLocalPlatformBootstrapConfig().defaultActivityRunId;

  await runLocalOrchestratorQuery({
    label: `audit ${activityRunId} via local authoritative orchestrator`,
    activityRunId,
    url: buildOrchestratorAuditUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      activityRunId,
      limit: readOptionInteger(options, "limit"),
    }),
  });
}

if (normalizedCommand === "command") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, commandType, payloadJson] = positional;
  if (!activityRunId || !commandType || !payloadJson) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildCommandEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId,
      type: commandType,
      payload: parsePayloadJson(payloadJson),
      idempotencyKey: `cmd-${commandType}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `${commandType} ${activityRunId}`,
  });
}

fail(`Unknown command "${command}".\n\n${USAGE}`);
