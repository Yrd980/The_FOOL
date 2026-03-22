import { describe, expect, test } from "bun:test";
import type { ActivityPackage } from "../src/openclaw/platform/activityRegistry";
import {
  buildSeedProjection,
  loadProjection,
} from "../scripts/orchestrator/bootstrap";
import type { ProjectionState } from "../scripts/orchestrator/support";

const bootstrapActivityPackage: ActivityPackage = {
  id: "test-activity",
  initialStageId: "act-1",
  stageTemplates: [{ id: "act-1", name: "Intro", allowedActions: ["query"] }],
  submissionSchemas: [],
  skillBindings: [],
  bootstrap: {
    world: {
      rooms: [{ id: "main-stage", label: "Main Stage" }],
      teams: [],
      entities: [],
    },
  },
  normalizeSubmissionData: (_schemaId, rawData) => rawData,
};

describe("orchestrator bootstrap", () => {
  test("builds a fresh seed projection from the bootstrap activity package", () => {
    const projection = buildSeedProjection({
      defaultActivityRunId: "activity-run-01",
      bootstrapActivityPackage,
      now: 1234,
    });

    expect(projection.activityRun).toEqual({
      id: "activity-run-01",
      templateId: "test-activity",
      status: "running",
      currentStageId: "act-1",
      startedAt: 1234,
    });
    expect(projection.snapshotId).toBe("snapshot-1234");
    expect(projection.world.rooms[0]?.id).toBe("main-stage");

    projection.stageTemplates[0]!.name = "Changed";
    expect(bootstrapActivityPackage.stageTemplates[0]?.name).toBe("Intro");
  });

  test("bootstraps the first activity.started event when the event log is empty", () => {
    const appendedEvents: Array<{ type: string; sequence: number }> = [];
    const writtenProjections: ProjectionState[] = [];
    const projection = loadProjection({
      ensureDataDir: () => {},
      parseJsonFile: () => null,
      projectionFilePath: "/tmp/projection.json",
      readEventLog: () => [],
      appendEventRecord: (event) => {
        appendedEvents.push({ type: event.type, sequence: event.sequence });
      },
      writeProjection: (nextProjection) => {
        writtenProjections.push(nextProjection);
      },
      buildSeedProjection: () =>
        buildSeedProjection({
          defaultActivityRunId: "activity-run-01",
          bootstrapActivityPackage,
          now: 1234,
        }),
      warn: () => {},
    });

    expect(appendedEvents).toEqual([{ type: "activity.started", sequence: 1 }]);
    expect(projection.lastSequence).toBe(1);
    expect(projection.activityRun.currentStageId).toBe("act-1");
    expect(writtenProjections.at(-1)?.lastSequence).toBe(1);
  });
});
