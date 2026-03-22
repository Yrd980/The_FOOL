import { buildOrchestratorSnapshotUrl } from "../../../src/openclaw/control";
import { resolveLocalPlatformBootstrapConfig } from "../../../src/openclaw/localPlatformConfig";
import {
  parseAsciiArgs,
  parseEventQueryArgs,
  parseLongOptions,
  readOptionInteger,
} from "../parse";
import {
  buildAuditQueryUrl,
  buildEventsQueryUrl,
  buildReplayQueryUrl,
  buildScoresQueryUrl,
  runAsciiOverview,
  runLocalOrchestratorQuery,
} from "../query";
import { requireLocalOrchestrator } from "../probe";
import { fail, resolveOrchestratorBaseUrl } from "../support";

export const handleProbe = async (): Promise<void> => {
  const { runProbe } = await import("../probe");
  await runProbe();
};

export const handleAscii = async (args: string[]): Promise<void> => {
  const ascii = parseAsciiArgs(args);
  await runAsciiOverview(ascii);
};

export const handleSnapshot = async (args: string[]): Promise<void> => {
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
};

export const handleEvents = async (args: string[]): Promise<void> => {
  const parsed = parseEventQueryArgs("events", args);
  await runLocalOrchestratorQuery({
    label: `events ${parsed.activityRunId} via local authoritative orchestrator`,
    activityRunId: parsed.activityRunId,
    url: buildEventsQueryUrl({
      query: parsed.query,
    }),
  });
};

export const handleScores = async (args: string[]): Promise<void> => {
  const parsed = parseEventQueryArgs("scores", args);
  await runLocalOrchestratorQuery({
    label: `scores ${parsed.activityRunId} via local authoritative orchestrator`,
    activityRunId: parsed.activityRunId,
    url: buildScoresQueryUrl({
      query: parsed.query,
    }),
  });
};

export const handleReplay = async (args: string[]): Promise<void> => {
  const parsed = parseEventQueryArgs("replay", args);
  await runLocalOrchestratorQuery({
    label: `replay ${parsed.activityRunId} via local authoritative orchestrator`,
    activityRunId: parsed.activityRunId,
    url: buildReplayQueryUrl({
      query: parsed.query,
    }),
  });
};

export const handleAudit = async (args: string[]): Promise<void> => {
  const { positional, options } = parseLongOptions(args);
  const [activityRunIdArgument] = positional;
  const activityRunId =
    activityRunIdArgument ?? resolveLocalPlatformBootstrapConfig().defaultActivityRunId;

  await runLocalOrchestratorQuery({
    label: `audit ${activityRunId} via local authoritative orchestrator`,
    activityRunId,
    url: buildAuditQueryUrl({
      activityRunId,
      limit: readOptionInteger(options, "limit"),
    }),
  });
};
