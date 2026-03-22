import {
  buildOrchestratorAuditUrl,
  buildOrchestratorEventsUrl,
  buildOrchestratorReplayUrl,
  buildOrchestratorScoresUrl,
} from "../../src/openclaw/control";
import { buildOpenClawAsciiOverview } from "../../src/openclaw/asciiOverview";
import type {
  OrchestratorEventPage,
  OrchestratorSnapshotResponse,
} from "../../src/openclaw/orchestratorQueryClient";
import {
  fail,
  printJsonAndExit,
  requestLocalOrchestrator,
  resolveLocalOrchestratorAuth,
} from "./support";
import { requireLocalOrchestrator } from "./probe";

export const runLocalOrchestratorQuery = async ({
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
    printJsonAndExit(verifiedSnapshotResponse);
  }

  const responseBody = await requestLocalOrchestrator({
    url,
    token,
  });
  printJsonAndExit(responseBody);
};

const loadLocalOrchestratorJson = async <T>(url: string): Promise<T> => {
  const { token } = resolveLocalOrchestratorAuth();
  return (await requestLocalOrchestrator({
    url,
    token,
  })) as T;
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

export const runAsciiOverview = async ({
  activityRunId,
  limit,
  watchSeconds,
}: {
  activityRunId: string;
  limit: number;
  watchSeconds?: number;
}): Promise<void> => {
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

export const buildAuditQueryUrl = ({
  activityRunId,
  limit,
}: {
  activityRunId: string;
  limit?: number;
}): string =>
  buildOrchestratorAuditUrl({
    baseUrl: resolveLocalOrchestratorAuth().baseUrl,
    activityRunId,
    limit,
  });

export const buildEventsQueryUrl = ({
  query,
}: {
  query: {
    activityRunId: string;
    afterSequence?: number;
    fromSequence?: number;
    toSequence?: number;
    limit?: number;
  };
}): string =>
  buildOrchestratorEventsUrl({
    baseUrl: resolveLocalOrchestratorAuth().baseUrl,
    query,
  });

export const buildScoresQueryUrl = ({
  query,
}: {
  query: {
    activityRunId: string;
    afterSequence?: number;
    fromSequence?: number;
    toSequence?: number;
    limit?: number;
  };
}): string =>
  buildOrchestratorScoresUrl({
    baseUrl: resolveLocalOrchestratorAuth().baseUrl,
    query,
  });

export const buildReplayQueryUrl = ({
  query,
}: {
  query: {
    activityRunId: string;
    afterSequence?: number;
    fromSequence?: number;
    toSequence?: number;
    limit?: number;
  };
}): string =>
  buildOrchestratorReplayUrl({
    baseUrl: resolveLocalOrchestratorAuth().baseUrl,
    query,
  });
