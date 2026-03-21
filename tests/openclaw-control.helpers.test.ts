import { describe, expect, test } from "bun:test";
import type { ActivityRoomCatalog } from "../src/openclaw/activityRuntime";
import {
  buildCommandEnvelope,
  buildCommandConfirmation,
  buildGatewayAgentCallArgs,
  buildGatewayDispatchCommandArgs,
  buildOrchestratorEventsUrl,
  buildOrchestratorSnapshotUrl,
  buildTransitionStageEnvelope,
  resolveDangerousCommandConfirmationRequirement,
  resolveSessionRoomId,
  satisfiesDangerousCommandConfirmation,
} from "../src/openclaw/control";

const roomCatalog: ActivityRoomCatalog = {
  packageId: "the-fool-v1",
  fallbackRoomId: "main-stage",
  roomIds: ["main-stage", "team-room-1"],
  aliasMap: {
    "main-stage": "main-stage",
    main: "main-stage",
    "team-room-1": "team-room-1",
    team1: "team-room-1",
  },
  labels: {
    "main-stage": "Main Stage",
    "team-room-1": "Team Room 1",
  },
};

describe("openclaw control helper contracts", () => {
  test("keeps dangerous confirmation challenges stable", () => {
    const command = buildTransitionStageEnvelope({
      actorId: "host-01",
      activityRunId: "activity-run-01",
      targetStageId: "act-5-submission",
      confirmation: buildCommandConfirmation("  PROMOTE   act-5-submission  "),
    });
    const requirement = resolveDangerousCommandConfirmationRequirement(command);

    expect(requirement).not.toBeNull();
    expect(requirement?.challenge).toBe("PROMOTE act-5-submission");
    expect(
      satisfiesDangerousCommandConfirmation({
        command,
        requirement: requirement!,
      }),
    ).toBe(true);
  });

  test("builds gateway dispatch args without changing transport shape", () => {
    const envelope = buildCommandEnvelope({
      actorId: "host-01",
      actorRole: "host",
      activityRunId: "activity-run-01",
      type: "transition_stage",
      payload: { targetStageId: "act-3-assignment" },
      issuedAt: 1234,
    });
    const args = buildGatewayDispatchCommandArgs({
      dispatchMethod: "orchestrator.command",
      commandEnvelope: envelope,
      gatewayUrl: "ws://127.0.0.1:4173/ws",
      token: "test-token",
      timeoutMs: 15000,
      commandParamKey: "cmd",
    });

    expect(args).toEqual([
      "gateway",
      "call",
      "orchestrator.command",
      "--timeout",
      "15000",
      "--url",
      "ws://127.0.0.1:4173/ws",
      "--token",
      "test-token",
      "--json",
      "--params",
      JSON.stringify({
        cmd: envelope,
      }),
    ]);
  });

  test("builds gateway agent args with normalized session identity", () => {
    const args = buildGatewayAgentCallArgs({
      agentId: " agent-01 ",
      room: "team1",
      message: "  Move now.  ",
      timeoutSeconds: 30,
      gatewayUrl: "ws://127.0.0.1:4173/ws",
      token: "test-token",
      idempotencyKey: "roomctl-1",
      activityPackageId: "the-fool-v1",
      roomCatalog,
    });

    expect(args).toEqual([
      "gateway",
      "call",
      "agent",
      "--timeout",
      "90000",
      "--url",
      "ws://127.0.0.1:4173/ws",
      "--expect-final",
      "--token",
      "test-token",
      "--json",
      "--params",
      JSON.stringify({
        agentId: "agent-01",
        message: "Move now.",
        sessionKey: "agent:agent-01:team-room-1",
        timeout: 30,
        idempotencyKey: "roomctl-1",
      }),
    ]);
  });

  test("keeps orchestrator query URLs and room fallbacks stable", () => {
    expect(
      buildOrchestratorSnapshotUrl({
        baseUrl: "ws://127.0.0.1:18791/",
        activityRunId: "activity-run-01",
      }),
    ).toBe(
      "http://127.0.0.1:18791/api/orchestrator/snapshot?activityRunId=activity-run-01",
    );
    expect(
      buildOrchestratorEventsUrl({
        baseUrl: "http://127.0.0.1:18791/",
        query: {
          activityRunId: "activity-run-01",
          afterSequence: 10,
          limit: 5,
        },
      }),
    ).toBe(
      "http://127.0.0.1:18791/api/orchestrator/events?activityRunId=activity-run-01&afterSequence=10&limit=5",
    );
    expect(resolveSessionRoomId(undefined, "the-fool-v1", { roomCatalog })).toBe(
      "main-stage",
    );
    expect(
      resolveSessionRoomId("agent:agent-01:unknown-room", "the-fool-v1", {
        roomCatalog,
      }),
    ).toBe("main-stage");
  });
});
