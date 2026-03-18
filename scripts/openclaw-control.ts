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
  buildSubmitScoreEnvelope,
  buildStartTimerEnvelope,
  buildTransitionStageEnvelope,
  buildUpdateSubmissionEnvelope,
  normalizeControlConfigValue,
  normalizeControlDispatchMethod,
  normalizeControlGatewayUrl,
  normalizeOrchestratorBaseUrl,
  resolveControlRoomId,
  summarizeGatewayOrchestrationContract,
  type CommandEnvelope,
  type ControlActorRole,
  type GatewayCapabilitySnapshot,
  type OrchestratorEventQuery,
  type SubmitScorePayload,
  type TeamProjectSubmissionData,
} from "../src/openclaw/control";

type CommandName =
  | "probe"
  | "move"
  | "say"
  | "stage"
  | "start-timer"
  | "open-submission"
  | "submit"
  | "update-submission"
  | "lock-submission"
  | "submit-score"
  | "grant-award"
  | "snapshot"
  | "scores"
  | "events"
  | "replay"
  | "audit"
  | "command";

const USAGE = `Usage:
  bun run openclaw:control -- probe
  bun run openclaw:control -- move <agent-id> <room>
  bun run openclaw:control -- say <agent-id> <room> <message>
  bun run openclaw:control -- stage <activity-run-id> <target-stage-id>
  bun run openclaw:control -- start-timer <activity-run-id> <stage-id> <duration-sec>
  bun run openclaw:control -- open-submission <activity-run-id> <submission-id>
  bun run openclaw:control -- submit <activity-run-id> <submission-id> <payload-json>
  bun run openclaw:control -- update-submission <activity-run-id> <submission-id> <payload-json>
  bun run openclaw:control -- lock-submission <activity-run-id> <submission-id>
  bun run openclaw:control -- submit-score <activity-run-id> <submission-id> <score-1..10> --reason <text> --favorite <text> --most-absurd <text>
  bun run openclaw:control -- grant-award <activity-run-id> <award-id> <entity-id> [label] [reason]
  bun run openclaw:control -- snapshot <activity-run-id>
  bun run openclaw:control -- scores <activity-run-id> [--after-sequence <n>] [--from-sequence <n>] [--to-sequence <n>] [--limit <n>]
  bun run openclaw:control -- events <activity-run-id> [--after-sequence <n>] [--from-sequence <n>] [--to-sequence <n>] [--limit <n>]
  bun run openclaw:control -- replay <activity-run-id> [--after-sequence <n>] [--from-sequence <n>] [--to-sequence <n>] [--limit <n>]
  bun run openclaw:control -- audit <activity-run-id> [--limit <n>]
  bun run openclaw:control -- command <activity-run-id> <command-type> <payload-json>

Rooms:
  main | team1 | team2 | team3 | quiet
  main-stage | team-room-1 | team-room-2 | team-room-3 | quiet-orbit

Optional env for command dispatch:
  OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791
  OPENCLAW_ORCHESTRATOR_TOKEN=<local-backend-token>
  OPENCLAW_COMMAND_METHOD=<verified-live-method>
  OPENCLAW_COMMAND_PARAM_KEY=command
  OPENCLAW_COMMAND_ACTOR_ID=molt-claw
  OPENCLAW_COMMAND_ACTOR_ROLE=host`;

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

const resolveGatewayToken = (): string | undefined =>
  resolveConfigValue("OPENCLAW_GATEWAY_TOKEN") ??
  resolveConfigValue("VITE_OPENCLAW_TOKEN") ??
  openClawGatewayToken;

const resolveOrchestratorBaseUrl = (): string =>
  normalizeOrchestratorBaseUrl(
    resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL") ??
      resolveConfigValue("VITE_OPENCLAW_ORCHESTRATOR_URL"),
  );

const resolveOrchestratorToken = (): string | undefined =>
  resolveConfigValue("OPENCLAW_ORCHESTRATOR_TOKEN") ??
  resolveConfigValue("VITE_OPENCLAW_TOKEN") ??
  resolveConfigValue("OPENCLAW_GATEWAY_TOKEN") ??
  openClawGatewayToken;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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
    return code ? `[${code}] ${message}` : message;
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
      : `Paired CLI/runtime provenance only shows stock gateway surfaces plus ${loadedPluginIds.join(", ") || "no loaded plugins"}. No activity/The Fool/orchestrator plugin source, gateway method, or service is currently visible.`;

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
}): Promise<never> => {
  const configuredOrchestratorUrl =
    resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL") ??
    resolveConfigValue("VITE_OPENCLAW_ORCHESTRATOR_URL");
  const orchestratorBaseUrl = resolveOrchestratorBaseUrl();
  const hasLocalOrchestratorUrl = Boolean(
    normalizeControlConfigValue(configuredOrchestratorUrl),
  );
  const dispatchMethod = normalizeControlDispatchMethod(
    resolveConfigValue("OPENCLAW_COMMAND_METHOD") ??
      resolveConfigValue("VITE_OPENCLAW_COMMAND_METHOD"),
  );
  const commandParamKey = resolveConfigValue("OPENCLAW_COMMAND_PARAM_KEY");
  const gatewayUrl =
    resolveConfigValue("OPENCLAW_GATEWAY_URL") ??
    resolveConfigValue("VITE_OPENCLAW_URL");
  const token = resolveGatewayToken();

  console.log(`[openclaw-control] ${summary}`);
  console.log(JSON.stringify(envelope, null, 2));

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
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN / VITE_OPENCLAW_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
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

  runOpenClaw(args);
};

const parsePayloadJson = (source: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      fail("Payload JSON must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    fail(`Invalid payload JSON: ${(error as Error).message}`);
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
  const token = resolveOrchestratorToken();
  if (!token) {
    fail(
      "Missing local orchestrator token. Set OPENCLAW_ORCHESTRATOR_TOKEN or VITE_OPENCLAW_TOKEN.",
    );
  }

  return {
    baseUrl: resolveOrchestratorBaseUrl(),
    token,
  };
};

const runLocalOrchestratorQuery = async ({
  label,
  url,
}: {
  label: string;
  url: string;
}): Promise<never> => {
  const { token } = resolveLocalOrchestratorAuth();
  console.log(`[openclaw-control] ${label}`);
  const responseBody = await requestLocalOrchestrator({
    url,
    token,
  });
  printJsonAndExit(responseBody);
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
  commandName: "submit" | "update-submission",
  rawArgs: string[],
): {
  activityRunId: string;
  submissionId: string;
  data: TeamProjectSubmissionData;
} => {
  const { positional } = parseLongOptions(rawArgs);
  const [activityRunId, submissionId, payloadJson] = positional;
  if (!activityRunId || !submissionId || !payloadJson) {
    fail(USAGE);
  }

  const parsed = parsePayloadJson(payloadJson);
  const posterOrDeck =
    typeof parsed.posterOrDeck === "string" ? parsed.posterOrDeck.trim() : "";
  const elevatorPitch =
    typeof parsed.elevatorPitch === "string" ? parsed.elevatorPitch.trim() : "";
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights.map((entry) =>
        typeof entry === "string" ? entry.trim() : "",
      )
    : [];
  const risk = typeof parsed.risk === "string" ? parsed.risk.trim() : "";

  if (!posterOrDeck || !elevatorPitch || !risk) {
    fail(
      `${commandName} payload must include non-empty posterOrDeck, elevatorPitch, and risk fields.`,
    );
  }

  if (
    highlights.length !== 3 ||
    highlights.some((entry) => entry.length === 0)
  ) {
    fail(
      `${commandName} payload must include highlights as an array of exactly 3 non-empty strings.`,
    );
  }

  return {
    activityRunId,
    submissionId,
    data: {
      posterOrDeck,
      elevatorPitch,
      highlights: highlights as [string, string, string],
      risk,
    },
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
  const favorite = options.favorite?.trim();
  const mostAbsurd =
    options["most-absurd"]?.trim() ??
    options.weirdest?.trim() ??
    options.absurd?.trim();

  if (!reason) {
    fail("submit-score requires --reason <text>.");
  }

  if (!favorite) {
    fail("submit-score requires --favorite <text>.");
  }

  if (!mostAbsurd) {
    fail(
      "submit-score requires --most-absurd <text>. Aliases --weirdest / --absurd are accepted.",
    );
  }

  return {
    activityRunId,
    scorePayload: {
      submissionId,
      score,
      reason,
      favorite,
      mostAbsurd,
    },
  };
};

const resolveActorId = (): string =>
  resolveConfigValue("OPENCLAW_COMMAND_ACTOR_ID") ?? "molt-claw";

const runProbe = async (): Promise<never> => {
  const gatewayUrl =
    resolveConfigValue("OPENCLAW_GATEWAY_URL") ??
    resolveConfigValue("VITE_OPENCLAW_URL");
  const token = resolveGatewayToken();

  if (!token) {
    fail(
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN / VITE_OPENCLAW_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
    );
  }

  const probe = await probeGatewaySession({ gatewayUrl, token });
  const dispatchMethod = normalizeControlDispatchMethod(
    resolveConfigValue("OPENCLAW_COMMAND_METHOD") ??
      resolveConfigValue("VITE_OPENCLAW_COMMAND_METHOD"),
  );
  const contract = summarizeGatewayOrchestrationContract({
    capabilities: {
      methods: probe.methods,
      events: probe.events,
    },
    configuredDispatchMethod: dispatchMethod,
  });
  const pairedCli = probePairedCliRuntime();

  console.log(
    JSON.stringify(
      {
        gatewayUrl: normalizeControlGatewayUrl(gatewayUrl),
        orchestrationContract: contract,
        configuredDispatchMethod: dispatchMethod ?? null,
        hello: {
          methods: probe.methods,
          events: probe.events,
          snapshotKeys: probe.hello.snapshotKeys,
          healthKeys: probe.hello.healthKeys,
          agentCount: probe.hello.agentCount,
          serviceTs: probe.hello.serviceTs,
        },
        rawStatus: probe.status,
        pairedCli,
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
  const [agentId, room, ...messageParts] = args;
  if (!agentId || !room) {
    fail(USAGE);
  }

  const message =
    normalizedCommand === "move"
      ? buildMoveMessage(room)
      : messageParts.join(" ").trim();

  if (!message) {
    fail(`A message is required for "${normalizedCommand}".\n\n${USAGE}`);
  }

  const token = resolveGatewayToken();
  if (!token) {
    fail(
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN / VITE_OPENCLAW_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
    );
  }

  const gatewayUrl =
    resolveConfigValue("OPENCLAW_GATEWAY_URL") ??
    resolveConfigValue("VITE_OPENCLAW_URL");
  const roomId = resolveControlRoomId(room);
  const idempotencyKey = `roomctl-${agentId}-${roomId}-${Date.now()}`;

  const openClawArgs = buildGatewayAgentCallArgs({
    agentId,
    room,
    message,
    timeoutSeconds: 120,
    gatewayUrl,
    token,
    idempotencyKey,
  });

  console.log(
    `[openclaw-control] ${normalizedCommand} ${agentId} -> ${roomId} (${message})`,
  );
  runOpenClaw(openClawArgs);
}

if (normalizedCommand === "stage") {
  const [activityRunId, targetStageId] = args;
  if (!activityRunId || !targetStageId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildTransitionStageEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      targetStageId,
      idempotencyKey: `stage-${activityRunId}-${targetStageId}-${Date.now()}`,
    }),
    summary: `transition_stage ${activityRunId} -> ${targetStageId}`,
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
  const { activityRunId, submissionId, data } = parseSubmissionCommandArgs(
    "submit",
    args,
  );
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
  const { activityRunId, submissionId, data } = parseSubmissionCommandArgs(
    "update-submission",
    args,
  );
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
  const [activityRunId, submissionId] = args;
  if (!activityRunId || !submissionId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildLockSubmissionEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId,
      idempotencyKey: `lock-${activityRunId}-${submissionId}-${Date.now()}`,
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
      favorite: scorePayload.favorite,
      mostAbsurd: scorePayload.mostAbsurd,
      idempotencyKey: `submit-score-${activityRunId}-${scorePayload.submissionId}-${Date.now()}`,
    }),
    summary: `submit_score ${activityRunId} / ${scorePayload.submissionId} (${scorePayload.score}/10)`,
  });
}

if (normalizedCommand === "grant-award") {
  const [activityRunId, awardId, entityId, label, ...reasonParts] = args;
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
    }),
    summary: `grant_award ${activityRunId} / ${awardId} -> ${entityId}`,
  });
}

if (normalizedCommand === "snapshot") {
  const [activityRunId] = args;
  if (!activityRunId) {
    fail(USAGE);
  }

  await runLocalOrchestratorQuery({
    label: `snapshot ${activityRunId} via local authoritative orchestrator`,
    url: buildOrchestratorSnapshotUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      activityRunId,
    }),
  });
}

if (normalizedCommand === "events") {
  const { activityRunId, query } = parseEventQueryArgs("events", args);
  await runLocalOrchestratorQuery({
    label: `events ${activityRunId} via local authoritative orchestrator`,
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
    url: buildOrchestratorReplayUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      query,
    }),
  });
}

if (normalizedCommand === "audit") {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId] = positional;
  if (!activityRunId) {
    fail(USAGE);
  }

  await runLocalOrchestratorQuery({
    label: `audit ${activityRunId} via local authoritative orchestrator`,
    url: buildOrchestratorAuditUrl({
      baseUrl: resolveOrchestratorBaseUrl(),
      activityRunId,
      limit: readOptionInteger(options, "limit"),
    }),
  });
}

if (normalizedCommand === "command") {
  const [activityRunId, commandType, payloadJson] = args;
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
    }),
    summary: `${commandType} ${activityRunId}`,
  });
}

fail(`Unknown command "${command}".\n\n${USAGE}`);
