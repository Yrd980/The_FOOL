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

const fetchFullReplay = async ({
  activityRunId,
  limit,
}: {
  activityRunId: string;
  limit: number;
}): Promise<OrchestratorEventPage> => {
  const { baseUrl } = resolveLocalOrchestratorAuth();
  const pageSize = Math.max(limit * 4, 40);
  let toSequence: number | undefined;
  let lastSequence = 0;
  let fromSequence: number | null = null;
  const allEvents: OrchestratorEventPage["events"] = [];

  while (true) {
    const page = await loadLocalOrchestratorJson<OrchestratorEventPage>(
      buildOrchestratorReplayUrl({
        baseUrl,
        query: {
          activityRunId,
          limit: pageSize,
          ...(toSequence === undefined ? {} : { toSequence }),
        },
      }),
    );
    lastSequence = page.lastSequence;
    fromSequence =
      fromSequence === null ? page.fromSequence : Math.min(fromSequence, page.fromSequence ?? fromSequence);

    const deduped = page.events.filter(
      (event) => !allEvents.some((entry) => entry.sequence === event.sequence),
    );
    allEvents.push(...deduped);

    if (!page.hasMore || page.events.length === 0) {
      return {
        ...page,
        fromSequence,
        toSequence: allEvents.reduce<number | null>(
          (highest, event) =>
            typeof event.sequence === "number"
              ? Math.max(highest ?? event.sequence, event.sequence)
              : highest,
          page.toSequence,
        ),
        lastSequence,
        hasMore: false,
        events: allEvents,
      };
    }

    const lowestSequence = page.events.reduce<number | null>(
      (lowest, event) =>
        typeof event.sequence === "number"
          ? Math.min(lowest ?? event.sequence, event.sequence)
          : lowest,
      null,
    );
    if (lowestSequence === null || lowestSequence <= 1) {
      return {
        ...page,
        fromSequence,
        toSequence: allEvents.reduce<number | null>(
          (highest, event) =>
            typeof event.sequence === "number"
              ? Math.max(highest ?? event.sequence, event.sequence)
              : highest,
          page.toSequence,
        ),
        lastSequence,
        hasMore: false,
        events: allEvents,
      };
    }
    toSequence = lowestSequence - 1;
  }
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
  const { baseUrl } = resolveLocalOrchestratorAuth();
  const eventsResponse = await loadLocalOrchestratorJson<OrchestratorEventPage>(
    buildOrchestratorEventsUrl({
      baseUrl,
      query: {
        activityRunId,
        limit,
      },
    }),
  );
  const replayResponse = await fetchFullReplay({
    activityRunId,
    limit,
  });

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
