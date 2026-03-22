import type { ActivityPackage } from "../../src/openclaw/platform/activityRegistry";
import type { EventEnvelope } from "../../src/openclaw/platform/contracts";
import {
  cloneJsonValue,
  type ProjectionState,
} from "./support";
import {
  buildBootstrapActivityStartedEvent,
  rebuildProjectionFromEventLog,
} from "./projection";

export const buildSeedProjection = ({
  defaultActivityRunId,
  bootstrapActivityPackage,
  now = Date.now(),
}: {
  defaultActivityRunId: string;
  bootstrapActivityPackage: ActivityPackage;
  now?: number;
}): ProjectionState => ({
  version: 7,
  snapshotId: `snapshot-${now}`,
  activityRun: {
    id: defaultActivityRunId,
    templateId: bootstrapActivityPackage.id,
    status: "running",
    currentStageId: bootstrapActivityPackage.initialStageId,
    startedAt: now,
  },
  stageTemplates: cloneJsonValue(bootstrapActivityPackage.stageTemplates),
  submissionSchemas: cloneJsonValue(bootstrapActivityPackage.submissionSchemas),
  world: cloneJsonValue(bootstrapActivityPackage.bootstrap.world),
  skills: cloneJsonValue(bootstrapActivityPackage.skillBindings),
  timers: [],
  submissions: [],
  scores: [],
  awards: [],
  talks: [],
  reactions: [],
  bets: [],
  votes: [],
  social: {
    audienceHeat: [],
    betHeat: [],
    reactionTotals: [],
    betSummary: [],
    voteSummary: [],
    betSettlements: [],
  },
  lastSequence: 0,
});

export const loadProjection = ({
  ensureDataDir,
  parseJsonFile,
  projectionFilePath,
  readEventLog,
  appendEventRecord,
  writeProjection,
  buildSeedProjection,
  warn = console.warn,
}: {
  ensureDataDir: () => void;
  parseJsonFile: <T>(filePath: string) => T | null;
  projectionFilePath: string;
  readEventLog: () => EventEnvelope[];
  appendEventRecord: (event: EventEnvelope) => void;
  writeProjection: (projection: ProjectionState) => void;
  buildSeedProjection: () => ProjectionState;
  warn?: (message: string) => void;
}): ProjectionState => {
  ensureDataDir();

  const storedProjection = parseJsonFile<ProjectionState>(projectionFilePath);
  const rawEvents = readEventLog();
  const events =
    rawEvents.length > 0
      ? rawEvents
      : (() => {
          const seedProjection = buildSeedProjection();
          const bootstrapEvent =
            buildBootstrapActivityStartedEvent(seedProjection);
          appendEventRecord(bootstrapEvent);
          return [bootstrapEvent];
        })();

  const rebuiltProjection = rebuildProjectionFromEventLog(
    events,
    buildSeedProjection(),
  );
  if (
    storedProjection &&
    storedProjection.lastSequence !== rebuiltProjection.lastSequence
  ) {
    warn(
      `[openclaw-orchestrator] Rebuilt projection from event log; stored projection lastSequence=${storedProjection.lastSequence}, rebuilt=${rebuiltProjection.lastSequence}.`,
    );
  }

  writeProjection(rebuiltProjection);
  return rebuiltProjection;
};
