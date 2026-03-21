import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  buildAssignTeamEnvelope,
  buildBetEnvelope,
  buildBroadcastEnvelope,
  buildCommandConfirmation,
  buildLockSubmissionEnvelope,
  buildOpenSubmissionEnvelope,
  buildReactionEnvelope,
  buildSubmitEnvelope,
  buildSubmitScoreEnvelope,
  buildTalkEnvelope,
  buildTransitionStageConfirmationChallenge,
  buildTransitionStageEnvelope,
} from "../src/openclaw/control";
import type { CommandEnvelope, CommandReceipt } from "../src/openclaw/platform/contracts";

const TEST_ACTIVITY_RUN_ID = "activity-run-01";
const TEST_ORCHESTRATOR_TOKEN = "test-orchestrator-token";
const TEST_HOST_ACTOR = "host-operator";
const TEST_JUDGES = ["judge-01", "judge-02", "judge-03"] as const;

interface ErrorBody {
  code: string;
  message: string;
  confirmation?: {
    required: boolean;
    challenge: string;
    confirmedAt?: number;
    providedChallenge?: string;
  };
  replayed?: boolean;
  replayedFromIdempotency?: string;
}

interface CommandErrorResponse {
  ok: false;
  error: ErrorBody;
}

interface CommandSuccessResponse {
  ok: true;
  receipt: CommandReceipt;
  snapshot: {
    activityRun: {
      currentStageId: string | null;
    };
  };
}

interface SnapshotResponse {
  ok: true;
  stageTemplates?: Array<{
    id: string;
  }>;
  submissionSchemas?: Array<{
    id: string;
  }>;
  snapshot: {
    snapshotId?: string;
    activityRun: {
      currentStageId: string | null;
    };
    world: {
      teams: Array<{
        id: string;
        roomId?: string;
      }>;
      entities: Array<{
        id: string;
        roomId?: string;
      }>;
    };
    submissions: Array<{
      id: string;
      teamId?: string;
      locked: boolean;
    }>;
  };
}

interface AuditResponse {
  ok: true;
  records: Array<{
    status: "accepted" | "replayed" | "rejected" | "conflict";
    commandType: string;
    idempotencyKey?: string;
    error?: {
      code: string;
    };
  }>;
}

interface ScoresResponse {
  ok: true;
  currentStageId: string | null;
  scoreCount: number;
  events?: Array<{
    type: string;
    sequence: number;
  }>;
  scoreSummary: Array<{
    targetId: string;
    judgeCount: number;
  }>;
}

interface EventsResponse {
  ok: true;
  activityRunId: string;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: Array<{
    type: string;
    sequence: number;
    payload?: Record<string, unknown>;
  }>;
}

interface RpcErrorPayload {
  code: string;
  message: string;
}

interface RpcOkFrame<T> {
  type: "res";
  id: string;
  ok: true;
  payload: T;
}

interface RpcErrorFrame {
  type: "res";
  id: string;
  ok: false;
  error: RpcErrorPayload;
}

interface RpcEventFrame {
  type: "event";
  event: string;
  payload: unknown;
}

type RpcFrame<T = unknown> = RpcOkFrame<T> | RpcErrorFrame | RpcEventFrame;

interface RpcClient {
  call: <T>(method: string, params?: Record<string, unknown>) => Promise<T>;
  waitForEvent: (eventName: string) => Promise<RpcEventFrame>;
  close: () => void;
}

interface OrchestratorHarness {
  baseUrl: string;
  command: (
    envelope: CommandEnvelope,
  ) => Promise<{ status: number; body: CommandSuccessResponse | CommandErrorResponse }>;
  snapshot: () => Promise<SnapshotResponse>;
  events: (limit?: number, extraQuery?: Record<string, string | number>) => Promise<EventsResponse>;
  replay: (limit?: number, extraQuery?: Record<string, string | number>) => Promise<EventsResponse>;
  audit: (limit?: number) => Promise<AuditResponse>;
  scores: (limit?: number) => Promise<ScoresResponse>;
  connectRpc: (instanceId?: string) => Promise<RpcClient>;
  stop: () => Promise<void>;
}

const harnesses = new Set<OrchestratorHarness>();
const rpcClients = new Set<RpcClient>();

const teamProjectPayload = (teamNumber: number) => ({
  posterOrDeck: `poster-${teamNumber}`,
  elevatorPitch: `Pitch ${teamNumber}`,
  highlights: [
    `Highlight ${teamNumber}.1`,
    `Highlight ${teamNumber}.2`,
    `Highlight ${teamNumber}.3`,
  ] as [string, string, string],
  risk: `Risk ${teamNumber}`,
});

const postCommand = async (
  baseUrl: string,
  envelope: CommandEnvelope,
): Promise<{ status: number; body: CommandSuccessResponse | CommandErrorResponse }> => {
  const response = await fetch(`${baseUrl}/api/orchestrator/commands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TEST_ORCHESTRATOR_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ command: envelope }),
  });

  return {
    status: response.status,
    body: (await response.json()) as CommandSuccessResponse | CommandErrorResponse,
  };
};

const getJson = async <T>(baseUrl: string, pathname: string): Promise<T> => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      authorization: `Bearer ${TEST_ORCHESTRATOR_TOKEN}`,
    },
  });

  expect(response.ok).toBe(true);
  return (await response.json()) as T;
};

const toQueryString = (query: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

const connectRpcClient = async (
  baseUrl: string,
  instanceId = "operator-client",
): Promise<RpcClient> => {
  const ws = new WebSocket(baseUrl.replace(/^http/, "ws"));
  const pendingCalls = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  const pendingEvents = new Map<
    string,
    Array<{
      resolve: (frame: RpcEventFrame) => void;
      reject: (error: Error) => void;
    }>
  >();
  const bufferedEvents = new Map<string, RpcEventFrame[]>();
  let rpcId = 0;

  const waitForOpen = new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener(
      "error",
      () => reject(new Error("WebSocket connection failed.")),
      { once: true },
    );
  });

  ws.addEventListener("message", (event) => {
    const frame = JSON.parse(String(event.data)) as RpcFrame;
    if (frame.type === "event") {
      const queue = pendingEvents.get(frame.event);
      const next = queue?.shift();
      if (next) {
        next.resolve(frame);
        if (queue && queue.length === 0) {
          pendingEvents.delete(frame.event);
        }
        return;
      }

      const buffered = bufferedEvents.get(frame.event) ?? [];
      buffered.push(frame);
      bufferedEvents.set(frame.event, buffered);
      return;
    }

    const pending = pendingCalls.get(frame.id);
    if (!pending) {
      return;
    }
    pendingCalls.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.payload);
      return;
    }
    pending.reject(new Error(frame.error.message));
  });

  const client: RpcClient = {
    call: <T>(method: string, params: Record<string, unknown> = {}) =>
      new Promise<T>((resolve, reject) => {
        const id = `rpc-${++rpcId}`;
        pendingCalls.set(id, { resolve: resolve as (value: unknown) => void, reject });
        ws.send(
          JSON.stringify({
            type: "req",
            id,
            method,
            params,
          }),
        );
      }),
    waitForEvent: (eventName: string) =>
      new Promise<RpcEventFrame>((resolve, reject) => {
        const buffered = bufferedEvents.get(eventName);
        const nextBuffered = buffered?.shift();
        if (nextBuffered) {
          if (buffered && buffered.length === 0) {
            bufferedEvents.delete(eventName);
          }
          resolve(nextBuffered);
          return;
        }

        const queue = pendingEvents.get(eventName) ?? [];
        queue.push({ resolve, reject });
        pendingEvents.set(eventName, queue);
      }),
    close: () => {
      ws.close();
    },
  };

  await waitForOpen;
  const challenge = await client.waitForEvent("connect.challenge");
  expect(challenge.payload).toBeTruthy();
  await client.call("connect", {
    auth: { token: TEST_ORCHESTRATOR_TOKEN },
    client: { instanceId },
    role: "operator",
  });

  rpcClients.add(client);
  return client;
};

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the child server is ready.
    }

    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for orchestrator health at ${baseUrl}.`);
};

const startHarness = async (): Promise<OrchestratorHarness> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "molt-claw-orchestrator-"));
  const port = 20000 + Math.floor(Math.random() * 10000);
  const child = spawn("bun", ["run", "./scripts/openclaw-orchestrator.ts"], {
    cwd: "/home/yrd/projects/The_FOOL/molt-claw",
    env: {
      ...process.env,
      OPENCLAW_ORCHESTRATOR_HOST: "127.0.0.1",
      OPENCLAW_ORCHESTRATOR_PORT: String(port),
      OPENCLAW_ORCHESTRATOR_TOKEN: TEST_ORCHESTRATOR_TOKEN,
      OPENCLAW_ORCHESTRATOR_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stopped = false;
  const baseUrl = `http://127.0.0.1:${port}`;

  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  try {
    await waitForHealth(baseUrl);
  } catch (error) {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }

  const harness: OrchestratorHarness = {
    baseUrl,
    command: (envelope) => postCommand(baseUrl, envelope),
    snapshot: () => getJson<SnapshotResponse>(baseUrl, `/api/orchestrator/snapshot?activityRunId=${TEST_ACTIVITY_RUN_ID}`),
    events: (limit = 20, extraQuery = {}) =>
      getJson<EventsResponse>(
        baseUrl,
        `/api/orchestrator/events${toQueryString({
          activityRunId: TEST_ACTIVITY_RUN_ID,
          limit,
          ...extraQuery,
        })}`,
      ),
    replay: (limit = 20, extraQuery = {}) =>
      getJson<EventsResponse>(
        baseUrl,
        `/api/orchestrator/replay${toQueryString({
          activityRunId: TEST_ACTIVITY_RUN_ID,
          limit,
          ...extraQuery,
        })}`,
      ),
    audit: (limit = 20) =>
      getJson<AuditResponse>(baseUrl, `/api/orchestrator/audit?activityRunId=${TEST_ACTIVITY_RUN_ID}&limit=${limit}`),
    scores: (limit = 20) =>
      getJson<ScoresResponse>(baseUrl, `/api/orchestrator/scores?activityRunId=${TEST_ACTIVITY_RUN_ID}&limit=${limit}`),
    connectRpc: (instanceId = "operator-client") => connectRpcClient(baseUrl, instanceId),
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true });
    },
  };

  harnesses.add(harness);
  return harness;
};

afterEach(async () => {
  const openRpcClients = [...rpcClients];
  rpcClients.clear();
  for (const client of openRpcClients) {
    client.close();
  }

  const running = [...harnesses];
  harnesses.clear();
  for (const harness of running) {
    await harness.stop();
  }
});

const expectAcceptedCommand = async (
  harness: OrchestratorHarness,
  envelope: CommandEnvelope,
): Promise<CommandReceipt> => {
  const response = await harness.command(envelope);
  expect(response.status).toBe(200);
  expect(response.body.ok).toBe(true);
  if (!response.body.ok) {
    throw new Error(response.body.error.message);
  }
  return response.body.receipt;
};

const transitionStage = async (
  harness: OrchestratorHarness,
  targetStageId: string,
  idempotencyKey?: string,
): Promise<CommandReceipt> =>
  expectAcceptedCommand(
    harness,
    buildTransitionStageEnvelope({
      actorId: TEST_HOST_ACTOR,
      activityRunId: TEST_ACTIVITY_RUN_ID,
      targetStageId,
      idempotencyKey,
      confirmation: buildCommandConfirmation(
        buildTransitionStageConfirmationChallenge(targetStageId),
        Date.now(),
      ),
    }),
  );

describe("openclaw orchestrator command chain", () => {
  test("requires confirmation for dangerous mutations", async () => {
    const harness = await startHarness();
    const missingConfirmation = await harness.command(
      buildTransitionStageEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        targetStageId: "act-5-submission",
      }),
    );

    expect(missingConfirmation.status).toBe(409);
    expect(missingConfirmation.body.ok).toBe(false);
    if (missingConfirmation.body.ok) {
      throw new Error("Expected confirmation error.");
    }
    expect(missingConfirmation.body.error.code).toBe("CONFIRMATION_REQUIRED");
    expect(missingConfirmation.body.error.confirmation?.challenge).toBe(
      "PROMOTE act-5-submission",
    );

    const acceptedReceipt = await transitionStage(harness, "act-5-submission");
    expect(acceptedReceipt.confirmation?.required).toBe(true);

    const snapshot = await harness.snapshot();
    expect(snapshot.snapshot.activityRun.currentStageId).toBe("act-5-submission");
  });

  test("replays identical idempotent commands and rejects conflicting payload reuse", async () => {
    const harness = await startHarness();
    await transitionStage(harness, "act-5-submission");
    const firstReceipt = await expectAcceptedCommand(
      harness,
      buildOpenSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-1",
        idempotencyKey: "idem-open-1",
      }),
    );

    const replayResponse = await harness.command(
      buildOpenSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-1",
        idempotencyKey: "idem-open-1",
      }),
    );
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.body.ok).toBe(true);
    if (!replayResponse.body.ok) {
      throw new Error(replayResponse.body.error.message);
    }
    expect(replayResponse.body.receipt.status).toBe("replayed");
    expect(replayResponse.body.receipt.replayed).toBe(true);
    expect(replayResponse.body.receipt.commandId).toBe(firstReceipt.commandId);

    const conflictResponse = await harness.command(
      buildOpenSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-2",
        idempotencyKey: "idem-open-1",
      }),
    );
    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.ok).toBe(false);
    if (conflictResponse.body.ok) {
      throw new Error("Expected idempotency conflict.");
    }
    expect(conflictResponse.body.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const audit = await harness.audit();
    const idempotencyAuditStatuses = audit.records
      .filter((record) => record.idempotencyKey === "idem-open-1")
      .map((record) => record.status);
    expect(idempotencyAuditStatuses).toEqual([
      "accepted",
      "replayed",
      "conflict",
    ]);
  });

  test("assign_team syncs member room occupancy when a room is provided", async () => {
    const harness = await startHarness();
    const receipt = await expectAcceptedCommand(
      harness,
      buildAssignTeamEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        teamId: "team-1",
        memberIds: ["contestant-01", "contestant-02"],
        roomId: "team-room-1",
        confirmation: buildCommandConfirmation("ASSIGN team-1", Date.now()),
      }),
    );

    expect(receipt.eventIds.length).toBe(3);

    const snapshot = await harness.snapshot();
    const team = snapshot.snapshot.world.teams.find((entry) => entry.id === "team-1");
    expect(team?.roomId).toBe("team-room-1");
    const memberRooms = snapshot.snapshot.world.entities
      .filter((entry) => ["contestant-01", "contestant-02"].includes(entry.id))
      .map((entry) => entry.roomId);
    expect(memberRooms).toEqual(["team-room-1", "team-room-1"]);

    const events = await harness.events(10);
    expect(events.events.map((event) => event.type)).toContain("team.assigned");
    expect(events.events.filter((event) => event.type === "entity.moved")).toHaveLength(2);
  });

  test("emits authoritative social events for talk, reaction, bet, and broadcast", async () => {
    const harness = await startHarness();

    await expectAcceptedCommand(
      harness,
      buildTalkEnvelope({
        actorId: "contestant-01",
        activityRunId: TEST_ACTIVITY_RUN_ID,
        message: "I contain three contradictory startup ideas.",
      }),
    );

    await expectAcceptedCommand(
      harness,
      buildReactionEnvelope({
        actorId: "contestant-02",
        activityRunId: TEST_ACTIVITY_RUN_ID,
        reaction: "clap",
        targetEntityId: "contestant-01",
        note: "wild opener",
      }),
    );

    await expectAcceptedCommand(
      harness,
      buildBetEnvelope({
        actorId: "contestant-03",
        activityRunId: TEST_ACTIVITY_RUN_ID,
        targetType: "team",
        targetId: "team-1",
        amount: 3,
        stance: "upset pick",
      }),
    );

    await transitionStage(harness, "act-3-assignment");

    await expectAcceptedCommand(
      harness,
      buildBroadcastEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        message: "Team draft is now authoritative.",
      }),
    );

    const replay = await harness.replay(20);
    const eventTypes = replay.events.map((event) => event.type);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        "agent.talked",
        "reaction.added",
        "bet.placed",
        "broadcast.sent",
      ]),
    );

    const talkEvent = replay.events.find((event) => event.type === "agent.talked");
    expect(talkEvent?.payload).toMatchObject({
      message: "I contain three contradictory startup ideas.",
      roomId: "main-stage",
    });

    const betEvent = replay.events.find((event) => event.type === "bet.placed");
    expect(betEvent?.payload).toMatchObject({
      targetType: "team",
      targetId: "team-1",
      amount: 3,
      stance: "upset pick",
    });

    const broadcastEvent = replay.events.find((event) => event.type === "broadcast.sent");
    expect(broadcastEvent?.payload).toMatchObject({
      message: "Team draft is now authoritative.",
      audienceScope: "global",
      stageId: "act-3-assignment",
    });
  });

  test("auto-transitions from act-5 to act-6 only after all required team submissions lock", async () => {
    const harness = await startHarness();
    await transitionStage(harness, "act-5-submission");

    for (const teamNumber of [1, 2] as const) {
      const submissionId = `submission-${teamNumber}`;
      await expectAcceptedCommand(
        harness,
        buildOpenSubmissionEnvelope({
          actorId: TEST_HOST_ACTOR,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          submissionId,
        }),
      );
      await expectAcceptedCommand(
        harness,
        buildSubmitEnvelope({
          actorId: `contestant-0${teamNumber}`,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          submissionId,
          data: teamProjectPayload(teamNumber),
        }),
      );
      await expectAcceptedCommand(
        harness,
        buildLockSubmissionEnvelope({
          actorId: TEST_HOST_ACTOR,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          submissionId,
          confirmation: buildCommandConfirmation(`LOCK ${submissionId}`, Date.now()),
        }),
      );
    }

    let snapshot = await harness.snapshot();
    expect(snapshot.snapshot.activityRun.currentStageId).toBe("act-5-submission");

    await expectAcceptedCommand(
      harness,
      buildOpenSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-3",
      }),
    );
    await expectAcceptedCommand(
      harness,
      buildSubmitEnvelope({
        actorId: "contestant-03",
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-3",
        data: teamProjectPayload(3),
      }),
    );
    const finalLockReceipt = await expectAcceptedCommand(
      harness,
      buildLockSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-3",
        confirmation: buildCommandConfirmation("LOCK submission-3", Date.now()),
      }),
    );

    expect(finalLockReceipt.emittedSequences.length).toBeGreaterThanOrEqual(2);
    snapshot = await harness.snapshot();
    expect(snapshot.snapshot.activityRun.currentStageId).toBe("act-6-human-review");
  });

  test("rejects draw outside draw stage and accepts it during act-9", async () => {
    const harness = await startHarness();
    const drawOutsideStage = await harness.command({
      id: "draw-outside-stage",
      actorId: "contestant-01",
      actorRole: "agent",
      activityRunId: TEST_ACTIVITY_RUN_ID,
      type: "draw",
      payload: {
        entityId: "contestant-01",
        data: {
          palette: "warm",
        },
      },
      issuedAt: Date.now(),
    });

    expect(drawOutsideStage.status).toBe(409);
    expect(drawOutsideStage.body.ok).toBe(false);
    if (drawOutsideStage.body.ok) {
      throw new Error("Expected stage gating error.");
    }
    expect(drawOutsideStage.body.error.code).toBe("STAGE_ACTION_NOT_ALLOWED");

    await transitionStage(harness, "act-9-co-creation");
    const drawAccepted = await harness.command({
      id: "draw-in-stage",
      actorId: "contestant-01",
      actorRole: "agent",
      activityRunId: TEST_ACTIVITY_RUN_ID,
      type: "draw",
      payload: {
        entityId: "contestant-01",
        data: {
          palette: "warm",
        },
      },
      issuedAt: Date.now(),
    });

    expect(drawAccepted.status).toBe(200);
    expect(drawAccepted.body.ok).toBe(true);
    if (!drawAccepted.body.ok) {
      throw new Error(drawAccepted.body.error.message);
    }
    expect(drawAccepted.body.receipt.eventIds.length).toBe(1);
  });

  test("auto-transitions from act-7 to act-8 after every locked submission receives all judge scores", async () => {
    const harness = await startHarness();
    await transitionStage(harness, "act-5-submission");

    for (const teamNumber of [1, 2, 3] as const) {
      const submissionId = `submission-${teamNumber}`;
      await expectAcceptedCommand(
        harness,
        buildOpenSubmissionEnvelope({
          actorId: TEST_HOST_ACTOR,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          submissionId,
        }),
      );
      await expectAcceptedCommand(
        harness,
        buildSubmitEnvelope({
          actorId: `contestant-0${teamNumber}`,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          submissionId,
          data: teamProjectPayload(teamNumber),
        }),
      );
      await expectAcceptedCommand(
        harness,
        buildLockSubmissionEnvelope({
          actorId: TEST_HOST_ACTOR,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          submissionId,
          confirmation: buildCommandConfirmation(`LOCK ${submissionId}`, Date.now()),
        }),
      );
    }

    await transitionStage(harness, "act-7-ai-judging");

    for (const submissionId of ["submission-1", "submission-2", "submission-3"] as const) {
      for (const [judgeIndex, judgeId] of TEST_JUDGES.entries()) {
        await expectAcceptedCommand(
          harness,
          buildSubmitScoreEnvelope({
            actorId: judgeId,
            activityRunId: TEST_ACTIVITY_RUN_ID,
            submissionId,
            score: 8 + judgeIndex,
            reason: `Judge note for ${submissionId}`,
            annotations: {
              favorite: `favorite-${judgeId}`,
              mostAbsurd: `most-absurd-${judgeId}`,
            },
          }),
        );
      }
    }

    const snapshot = await harness.snapshot();
    expect(snapshot.snapshot.activityRun.currentStageId).toBe("act-8-awards");

    const scores = await harness.scores();
    expect(scores.currentStageId).toBe("act-8-awards");
    expect(scores.scoreCount).toBe(9);
    expect(scores.scoreSummary.map((entry) => entry.judgeCount)).toEqual([3, 3, 3]);
  });

  test("serves consistent HTTP snapshot, events, replay, audit, and scores queries", async () => {
    const harness = await startHarness();
    await transitionStage(harness, "act-5-submission");
    await expectAcceptedCommand(
      harness,
      buildOpenSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-1",
      }),
    );
    await expectAcceptedCommand(
      harness,
      buildSubmitEnvelope({
        actorId: "contestant-01",
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-1",
        data: teamProjectPayload(1),
      }),
    );
    await expectAcceptedCommand(
      harness,
      buildLockSubmissionEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        submissionId: "submission-1",
        confirmation: buildCommandConfirmation("LOCK submission-1", Date.now()),
      }),
    );

    const snapshot = await harness.snapshot();
    expect(snapshot.stageTemplates?.some((stage) => stage.id === "act-5-submission")).toBe(true);
    expect(snapshot.submissionSchemas?.some((schema) => schema.id === "team-project-v1")).toBe(true);
    expect(snapshot.snapshot.submissions.find((submission) => submission.id === "submission-1")?.locked).toBe(
      true,
    );

    const events = await harness.events(10);
    expect(events.events.map((event) => event.type)).toContain("submission.opened");
    expect(events.events.map((event) => event.type)).toContain("submission.updated");
    expect(events.events.map((event) => event.type)).toContain("submission.locked");

    const replay = await harness.replay(10);
    expect(replay.events.map((event) => event.sequence)).toEqual(
      events.events.map((event) => event.sequence),
    );

    const fromSequence = events.events.find((event) => event.type === "submission.updated")?.sequence;
    expect(fromSequence).toBeDefined();
    const filteredEvents = await harness.events(10, { fromSequence: fromSequence! });
    expect(filteredEvents.events[0]?.sequence).toBe(fromSequence!);

    const audit = await harness.audit(10);
    expect(audit.records.map((record) => record.commandType)).toEqual([
      "transition_stage",
      "open_submission",
      "submit",
      "lock_submission",
    ]);
    expect(audit.records.every((record) => record.status === "accepted")).toBe(true);

    const scores = await harness.scores(10);
    expect(scores.scoreCount).toBe(0);
    expect(scores.events).toEqual([]);
  });

  test("supports websocket RPC connect, status, query, and command flows", async () => {
    const harness = await startHarness();
    const rpc = await harness.connectRpc("ws-operator");

    const statusPayload = await rpc.call<{
      sessions: {
        recent: Array<{
          agentId: string;
          key: string;
        }>;
      };
    }>("status");
    expect(statusPayload.sessions.recent.some((session) => session.agentId === "ws-operator")).toBe(
      true,
    );

    const initialSnapshot = await rpc.call<{
      snapshot: {
        activityRun: {
          currentStageId: string | null;
        };
      };
      stageTemplates: Array<{ id: string }>;
    }>("orchestrator.snapshot", {
      activityRunId: TEST_ACTIVITY_RUN_ID,
    });
    expect(initialSnapshot.snapshot.activityRun.currentStageId).toBe("act-1-intro");
    expect(initialSnapshot.stageTemplates.some((stage) => stage.id === "act-7-ai-judging")).toBe(
      true,
    );

    const missingConfirmationError = await rpc
      .call("orchestrator.command", {
        command: buildTransitionStageEnvelope({
          actorId: TEST_HOST_ACTOR,
          activityRunId: TEST_ACTIVITY_RUN_ID,
          targetStageId: "act-5-submission",
        }),
      })
      .then(() => null)
      .catch((error: Error) => error);
    expect(missingConfirmationError).toBeInstanceOf(Error);
    expect(missingConfirmationError?.message).toContain("requires confirmation");

    const acceptedCommand = await rpc.call<{
      receipt: CommandReceipt;
      snapshot: {
        activityRun: {
          currentStageId: string | null;
        };
      };
    }>("orchestrator.command", {
      command: buildTransitionStageEnvelope({
        actorId: TEST_HOST_ACTOR,
        activityRunId: TEST_ACTIVITY_RUN_ID,
        targetStageId: "act-5-submission",
        confirmation: buildCommandConfirmation(
          buildTransitionStageConfirmationChallenge("act-5-submission"),
          Date.now(),
        ),
      }),
    });
    expect(acceptedCommand.receipt.status).toBe("accepted");
    expect(acceptedCommand.snapshot.activityRun.currentStageId).toBe("act-5-submission");

    const healthEvent = await rpc.waitForEvent("health");
    expect(healthEvent.payload).toBeTruthy();

    const rpcEvents = await rpc.call<EventsResponse>("orchestrator.events", {
      activityRunId: TEST_ACTIVITY_RUN_ID,
      limit: 10,
    });
    expect(rpcEvents.events.some((event) => event.type === "stage.changed")).toBe(true);

    const rpcScores = await rpc.call<ScoresResponse>("orchestrator.scores", {
      activityRunId: TEST_ACTIVITY_RUN_ID,
      limit: 10,
    });
    expect(rpcScores.scoreCount).toBe(0);
  });
});
