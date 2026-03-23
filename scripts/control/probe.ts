import {
  GATEWAY_CONNECT_CLIENT_ID,
  GATEWAY_CONNECT_CLIENT_MODE,
  GATEWAY_OPERATOR_READ_SCOPE,
  buildOrchestratorSnapshotUrl,
  normalizeControlDispatchMethod,
  normalizeControlGatewayUrl,
  summarizeGatewayOrchestrationContract,
  type GatewayCapabilitySnapshot,
} from "../../src/openclaw/control";
import {
  buildWorldRoomCatalog,
  tryResolveActivityPackageId,
  type ActivityRoomCatalog,
} from "../../src/openclaw/activityRuntime";
import type { WorldProjection } from "../../src/openclaw/platform/contracts";
import type { OrchestratorSnapshotResponse } from "../../src/openclaw/orchestratorQueryClient";
import {
  buildLocalOrchestratorFailureNote,
  fail,
  formatOrchestratorError,
  isRecord,
  readString,
  readStringArray,
  resolveConfigValue,
  resolveGatewayToken,
  resolveOrchestratorBaseUrl,
  resolveOrchestratorToken,
  resolveConfiguredActivityRunId,
  runOpenClawJson,
} from "./support";

export interface GatewayHelloSummary {
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

export interface GatewayProbeSummary extends GatewayCapabilitySnapshot {
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

export interface LocalOrchestratorProbeSummary {
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

export interface AgentCommandActivityContext {
  activityPackageId: string | null;
  roomCatalog: ActivityRoomCatalog | null;
  note: string | null;
}

const KNOWN_STOCK_PLUGIN_IDS = new Set([
  "memory-core",
  "telegram",
  "camofox-browser",
]);

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

const summarizeStatusPayload = (payload: unknown): {
  sessionCount: number | null;
  recentSessionKeys: string[];
} => {
  if (!isRecord(payload)) {
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
      .map((profile) => (isRecord(profile) ? readString(profile, "id") : null))
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
          .filter(([, value]) => isRecord(value) && value.enabled === true)
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

export const probePairedCliRuntime = (): PairedCliProbeSummary => {
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
      plugin.gatewayMethods.length > 0 || plugin.services.length > 0,
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

export const probeGatewaySession = async ({
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

export const probeLocalOrchestrator = async (
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

export const requireLocalOrchestrator = async (
  activityRunId: string,
): Promise<LocalOrchestratorProbeSummary> => {
  const probe = await probeLocalOrchestrator(activityRunId);
  if (probe.status !== "available" || !probe.snapshotResponse) {
    fail(`[openclaw-control] ${probe.note}`);
  }

  return probe;
};

export const resolveAgentCommandActivityContext = async ({
  activityRunId,
}: {
  activityRunId?: string;
}): Promise<AgentCommandActivityContext> => {
  const configuredOrchestratorUrl = resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL");
  if (!configuredOrchestratorUrl?.trim()) {
    return {
      activityPackageId: null,
      roomCatalog: null,
      note:
        "OPENCLAW_ORCHESTRATOR_URL is required for authoritative room resolution.",
    };
  }

  const orchestratorToken = resolveOrchestratorToken();
  if (!orchestratorToken) {
    return {
      activityPackageId: null,
      roomCatalog: null,
      note:
        "OPENCLAW_ORCHESTRATOR_TOKEN is required for authoritative room resolution.",
    };
  }

  try {
    const probe = await probeLocalOrchestrator(
      resolveConfiguredActivityRunId(activityRunId),
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

export const runProbe = async (): Promise<void> => {
  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  const resolvedToken = resolveGatewayToken();
  const activityRunId = resolveConfiguredActivityRunId();
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
          "Missing OpenClaw gateway token. Set OPENCLAW_GATEWAY_TOKEN.",
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
