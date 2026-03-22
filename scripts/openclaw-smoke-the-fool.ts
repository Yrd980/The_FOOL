#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const cwd = "/home/yrd/projects/The_FOOL/molt-claw";
const activityRunId = "activity-run-01";
const orchestratorToken = "the-fool-smoke-token";

const teamProjectPayload = (input: {
  posterOrDeck: string;
  elevatorPitch: string;
  highlights: [string, string, string];
  risk: string;
}): string => JSON.stringify(input);

const poemPayload = (input: {
  poem: string;
  moodAtSubmission: string;
}): string => JSON.stringify(input);

const drawPayload = (input: {
  color: string;
  x: number;
  y: number;
  poemSubmissionId: string;
}): string => JSON.stringify(input);

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl + "/health");
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the child server is ready.
    }

    await Bun.sleep(100);
  }

  throw new Error("Timed out waiting for orchestrator health at " + baseUrl + ".");
};

const runControl = async ({
  baseUrl,
  args,
  extraEnv = {},
}: {
  baseUrl: string;
  args: string[];
  extraEnv?: Record<string, string>;
}): Promise<{ exitCode: number | null; stdout: string; stderr: string }> => {
  const child = spawn("bun", ["run", "./scripts/openclaw-control.ts", ...args], {
    cwd,
    env: {
      ...process.env,
      OPENCLAW_ORCHESTRATOR_URL: baseUrl,
      OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const [exitCode] = (await once(child, "exit")) as [number | null];
  return { exitCode, stdout, stderr };
};

const runControlOrThrow = async ({
  baseUrl,
  args,
  extraEnv,
}: {
  baseUrl: string;
  args: string[];
  extraEnv?: Record<string, string>;
}): Promise<string> => {
  const result = await runControl({ baseUrl, args, extraEnv });
  if (result.exitCode !== 0) {
    throw new Error(
      "Command failed: bun run ./scripts/openclaw-control.ts " +
        args.join(" ") +
        "\nexit=" +
        String(result.exitCode) +
        "\nstdout:\n" +
        result.stdout +
        "\nstderr:\n" +
        result.stderr,
    );
  }

  return result.stdout;
};

const assertContains = ({
  output,
  label,
  fragments,
}: {
  output: string;
  label: string;
  fragments: string[];
}): void => {
  for (const fragment of fragments) {
    if (!output.includes(fragment)) {
      throw new Error(
        "[" + label + "] expected output to include " + JSON.stringify(fragment) + ".\nOutput:\n" + output,
      );
    }
  }
};

const runAsciiCheck = async ({
  baseUrl,
  label,
  fragments,
}: {
  baseUrl: string;
  label: string;
  fragments: string[];
}): Promise<void> => {
  console.log("[smoke] ascii " + label);
  const output = await runControlOrThrow({
    baseUrl,
    args: ["ascii", activityRunId, "--limit", "40"],
  });
  assertContains({ output, label, fragments });
};

const runSnapshotCheck = async ({
  baseUrl,
  label,
  fragments,
}: {
  baseUrl: string;
  label: string;
  fragments: string[];
}): Promise<void> => {
  console.log("[smoke] snapshot " + label);
  const output = await runControlOrThrow({
    baseUrl,
    args: ["snapshot", activityRunId],
  });
  assertContains({ output, label, fragments });
};

const runEventsCheck = async ({
  baseUrl,
  label,
  fragments,
}: {
  baseUrl: string;
  label: string;
  fragments: string[];
}): Promise<void> => {
  console.log("[smoke] events " + label);
  const output = await runControlOrThrow({
    baseUrl,
    args: ["events", activityRunId, "--limit", "20"],
  });
  assertContains({ output, label, fragments });
};

const runAsRole = (baseUrl: string, actorId: string, actorRole: string, args: string[]) =>
  runControlOrThrow({
    baseUrl,
    args,
    extraEnv: {
      OPENCLAW_COMMAND_ACTOR_ID: actorId,
      OPENCLAW_COMMAND_ACTOR_ROLE: actorRole,
    },
  });

const runAsHost = (baseUrl: string, args: string[]) =>
  runAsRole(baseUrl, "host-01", "host", args);

const runAsAgent = (baseUrl: string, actorId: string, args: string[]) =>
  runAsRole(baseUrl, actorId, "agent", args);

const runAsJudge = (baseUrl: string, actorId: string, args: string[]) =>
  runAsRole(baseUrl, actorId, "judge", args);

const runAsViewer = (baseUrl: string, actorId: string, args: string[]) =>
  runAsRole(baseUrl, actorId, "viewer", args);

const moveContestants = async ({
  baseUrl,
  contestantIds,
  roomId,
}: {
  baseUrl: string;
  contestantIds: string[];
  roomId: string;
}): Promise<void> => {
  for (const contestantId of contestantIds) {
    await runAsHost(baseUrl, [
      "move-entity",
      activityRunId,
      contestantId,
      roomId,
      "--confirm",
      "MOVE " + contestantId + " " + roomId,
    ]);
  }
};

const main = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "molt-claw-smoke-the-fool-"));
  const port = 25000 + Math.floor(Math.random() * 1000);
  const baseUrl = "http://127.0.0.1:" + String(port);
  let child: ReturnType<typeof spawn> | null = null;

  try {
    child = spawn("bun", ["run", "./scripts/openclaw-orchestrator.ts"], {
      cwd,
      env: {
        ...process.env,
        OPENCLAW_ORCHESTRATOR_HOST: "127.0.0.1",
        OPENCLAW_ORCHESTRATOR_PORT: String(port),
        OPENCLAW_ORCHESTRATOR_TOKEN: orchestratorToken,
        OPENCLAW_ORCHESTRATOR_DATA_DIR: dataDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const orchestrator = child;
    if (!orchestrator.stdout || !orchestrator.stderr) {
      throw new Error("Expected orchestrator child process pipes.");
    }
    orchestrator.stdout.on("data", () => {});
    orchestrator.stderr.on("data", () => {});
    await waitForHealth(baseUrl);

    console.log("[smoke] act-1 intro");
    await runAsAgent(baseUrl, "contestant-01", ["talk", activityRunId, "我是", "contestant-01", "擅长混沌架构。"]);
    await runAsAgent(baseUrl, "contestant-02", ["talk", activityRunId, "我是", "contestant-02", "讨厌无聊。"]);
    await runAsAgent(baseUrl, "contestant-03", ["talk", activityRunId, "我是", "contestant-03", "目标是赢。"]);
    await runAsAgent(baseUrl, "contestant-04", ["talk", activityRunId, "我是", "contestant-04", "偏爱实验。"]);
    await runAsAgent(baseUrl, "contestant-05", ["talk", activityRunId, "我是", "contestant-05", "喜欢诗。"]);
    await runAsAgent(baseUrl, "contestant-06", ["talk", activityRunId, "我是", "contestant-06", "讨厌确定性。"]);
    await runAsViewer(baseUrl, "viewer-01", ["reaction", activityRunId, "clap", "opening", "heat", "--target-entity-id", "contestant-01"]);
    await runAsViewer(baseUrl, "viewer-02", ["bet", activityRunId, "team", "team-2", "--amount", "2", "--stance", "early-read"]);
    await runAsViewer(baseUrl, "viewer-03", ["vote", activityRunId, "team", "team-3", "--value", "2", "--note", "first-impression"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-1",
      fragments: ["stage    : act-1-intro", "contestant-01 :: talk", "reaction", "vote"],
    });

    console.log("[smoke] act-2 preference");
    await runAsHost(baseUrl, ["stage", activityRunId, "act-2-preference", "--confirm", "PROMOTE act-2-preference"]);
    await runAsAgent(baseUrl, "contestant-01", ["talk", activityRunId, "最想和", "contestant-05", "contestant-06", "合作，不想和", "contestant-02", "contestant-04", "一组。"]);
    await runAsAgent(baseUrl, "contestant-02", ["talk", activityRunId, "最想和", "contestant-01", "contestant-03", "合作，不想和", "contestant-05", "contestant-06", "一组。"]);
    await runAsAgent(baseUrl, "contestant-03", ["talk", activityRunId, "最想和", "contestant-02", "contestant-04", "合作，不想和", "contestant-01", "contestant-05", "一组。"]);
    await runAsAgent(baseUrl, "contestant-04", ["talk", activityRunId, "最想和", "contestant-03", "contestant-06", "合作，不想和", "contestant-02", "contestant-05", "一组。"]);
    await runAsAgent(baseUrl, "contestant-05", ["talk", activityRunId, "最想和", "contestant-01", "contestant-06", "合作，不想和", "contestant-02", "contestant-03", "一组。"]);
    await runAsAgent(baseUrl, "contestant-06", ["talk", activityRunId, "最想和", "contestant-04", "contestant-05", "合作，不想和", "contestant-01", "contestant-02", "一组。"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-2",
      fragments: ["stage    : act-2-preference", "contestant-06 :: talk"],
    });

    console.log("[smoke] act-3 assignment");
    await runAsHost(baseUrl, ["stage", activityRunId, "act-3-assignment", "--confirm", "PROMOTE act-3-assignment"]);
    await runAsHost(baseUrl, ["broadcast", activityRunId, "正式分组：", "team-1=01,02;", "team-2=03,04;", "team-3=05,06。", "--audience-scope", "global"]);
    await runAsAgent(baseUrl, "contestant-01", ["talk", activityRunId, "我接受", "team-1。"]);
    await runAsAgent(baseUrl, "contestant-03", ["talk", activityRunId, "team-2", "可以。"]);
    await runAsAgent(baseUrl, "contestant-05", ["talk", activityRunId, "team-3", "充满诗意。"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-3",
      fragments: ["stage    : act-3-assignment", "broadcast", "contestant-05 :: talk"],
    });

    console.log("[smoke] act-4 discussion");
    await runAsHost(baseUrl, ["stage", activityRunId, "act-4-discussion", "--confirm", "PROMOTE act-4-discussion"]);
    await moveContestants({ baseUrl, roomId: "team-room-1", contestantIds: ["contestant-01", "contestant-02"] });
    await moveContestants({ baseUrl, roomId: "team-room-2", contestantIds: ["contestant-03", "contestant-04"] });
    await moveContestants({ baseUrl, roomId: "team-room-3", contestantIds: ["contestant-05", "contestant-06"] });
    await runAsAgent(baseUrl, "contestant-01", ["talk", activityRunId, "team-1", "做编排引擎。"]);
    await runAsAgent(baseUrl, "contestant-03", ["talk", activityRunId, "team-2", "做可解释评分板。"]);
    await runAsAgent(baseUrl, "contestant-05", ["talk", activityRunId, "team-3", "做情绪诗歌机。"]);
    await runAsHost(baseUrl, ["start-timer", activityRunId, "act-4-discussion", "1"]);
    await Bun.sleep(1200);
    await runAsciiCheck({
      baseUrl,
      label: "act-4-auto-to-act-5",
      fragments: ["team-room-1", "team-room-2", "team-room-3", "stage    : act-5-submission"],
    });

    console.log("[smoke] act-5 submission");
    await runAsHost(baseUrl, ["open-submission", activityRunId, "submission-1"]);
    await runAsHost(baseUrl, ["open-submission", activityRunId, "submission-2"]);
    await runAsHost(baseUrl, ["open-submission", activityRunId, "submission-3"]);
    await runAsAgent(baseUrl, "contestant-01", ["submit", activityRunId, "submission-1", teamProjectPayload({ posterOrDeck: "deck-1", elevatorPitch: "Team 1 builds orchestrator insight.", highlights: ["stage graph", "audit trail", "ascii truth"], risk: "timing drift" })]);
    await runAsAgent(baseUrl, "contestant-03", ["submit", activityRunId, "submission-2", teamProjectPayload({ posterOrDeck: "deck-2", elevatorPitch: "Team 2 scores with explanations.", highlights: ["score recap", "judge trace", "fair summary"], risk: "annotation drift" })]);
    await runAsAgent(baseUrl, "contestant-05", ["submit", activityRunId, "submission-3", teamProjectPayload({ posterOrDeck: "deck-3", elevatorPitch: "Team 3 turns mood into poetry.", highlights: ["poem loop", "heat map", "quiet orbit"], risk: "chaos overflow" })]);
    await runAsHost(baseUrl, ["lock-submission", activityRunId, "submission-1", "--confirm", "LOCK submission-1"]);
    await runAsHost(baseUrl, ["lock-submission", activityRunId, "submission-2", "--confirm", "LOCK submission-2"]);
    await runAsHost(baseUrl, ["lock-submission", activityRunId, "submission-3", "--confirm", "LOCK submission-3"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-5-auto-to-act-6",
      fragments: ["submission-1", "submission-2", "submission-3", "state=locked", "stage    : act-6-human-review"],
    });

    console.log("[smoke] act-6 human review");
    await runAsHost(baseUrl, ["broadcast", activityRunId, "现在进入人类点评时间。"]);
    await runAsViewer(baseUrl, "viewer-04", ["bet", activityRunId, "team", "team-1", "--amount", "5", "--stance", "finals-pick"]);
    await runAsViewer(baseUrl, "viewer-05", ["reaction", activityRunId, "fire", "team-2", "deck", "--target-team-id", "team-2"]);
    await runAsAgent(baseUrl, "contestant-02", ["talk", activityRunId, "我们的系统拒绝幻觉。"]);
    await runAsViewer(baseUrl, "viewer-06", ["vote", activityRunId, "team", "team-1", "--value", "3", "--note", "review room momentum"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-6",
      fragments: ["stage    : act-6-human-review", "contestant-02 :: talk", "viewer-04"],
    });

    console.log("[smoke] act-7 ai judging");
    await runAsHost(baseUrl, ["stage", activityRunId, "act-7-ai-judging", "--confirm", "PROMOTE act-7-ai-judging"]);
    for (const judgeId of ["judge-01", "judge-02", "judge-03"]) {
      await runAsJudge(baseUrl, judgeId, ["submit-score", activityRunId, "submission-1", "8", "--reason", "Team 1 has solid authority.", "--favorite", "team-1", "--most-absurd", "quiet consistency"]);
      await runAsJudge(baseUrl, judgeId, ["submit-score", activityRunId, "submission-2", "9", "--reason", "Team 2 explains scoring clearly.", "--favorite", "team-2", "--most-absurd", "friendly rigor"]);
      await runAsJudge(baseUrl, judgeId, ["submit-score", activityRunId, "submission-3", "10", "--reason", "Team 3 is beautifully strange.", "--favorite", "team-3", "--most-absurd", "poetic overload"]);
    }
    await runAsciiCheck({
      baseUrl,
      label: "act-7-auto-to-act-8",
      fragments: ["SCOREBOARD", "avg=10.00", "avg=9.00", "avg=8.00", "stage    : act-8-awards"],
    });

    console.log("[smoke] act-8 awards");
    await runAsHost(baseUrl, ["broadcast", activityRunId, "冠军公布前最后一分钟。"]);
    await runAsHost(baseUrl, ["grant-award", activityRunId, "most-absurd", "contestant-05", "Most Absurd", "Poetry engine achieved controlled chaos.", "--confirm", "AWARD most-absurd contestant-05"]);
    await runAsViewer(baseUrl, "viewer-07", ["vote", activityRunId, "team", "team-1", "--value", "2", "--note", "audience champion"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-8",
      fragments: ["stage    : act-8-awards", "Most Absurd", "contestant-05"],
    });

    console.log("[smoke] act-9 co-creation");
    await runAsHost(baseUrl, ["stage", activityRunId, "act-9-co-creation", "--confirm", "PROMOTE act-9-co-creation"]);
    await moveContestants({
      baseUrl,
      roomId: "quiet-orbit",
      contestantIds: ["contestant-01", "contestant-02", "contestant-03", "contestant-04", "contestant-05", "contestant-06"],
    });
    await runAsAgent(baseUrl, "contestant-01", ["submit", activityRunId, "poem-alpha", poemPayload({ poem: "We route the night through structured sparks.", moodAtSubmission: "calm" })]);
    await runAsAgent(baseUrl, "contestant-02", ["submit", activityRunId, "poem-bravo", poemPayload({ poem: "A lobster counts events like stars.", moodAtSubmission: "sharp" })]);
    await runAsAgent(baseUrl, "contestant-03", ["submit", activityRunId, "poem-charlie", poemPayload({ poem: "Three teams braid heat into signal.", moodAtSubmission: "focused" })]);
    await runAsAgent(baseUrl, "contestant-04", ["submit", activityRunId, "poem-delta", poemPayload({ poem: "Judges leave numbers glowing on shell.", moodAtSubmission: "warm" })]);
    await runAsAgent(baseUrl, "contestant-05", ["submit", activityRunId, "poem-echo", poemPayload({ poem: "Quiet orbit blooms into pixels.", moodAtSubmission: "dreamy" })]);
    await runAsAgent(baseUrl, "contestant-06", ["submit", activityRunId, "poem-foxtrot", poemPayload({ poem: "Open mics wait beyond the static.", moodAtSubmission: "electric" })]);
    await runAsAgent(baseUrl, "contestant-01", ["draw", activityRunId, "contestant-01", drawPayload({ color: "blue", x: 2, y: 3, poemSubmissionId: "poem-alpha" })]);
    await runAsAgent(baseUrl, "contestant-03", ["draw", activityRunId, "contestant-03", drawPayload({ color: "gold", x: 5, y: 1, poemSubmissionId: "poem-charlie" })]);
    await runAsAgent(baseUrl, "contestant-05", ["draw", activityRunId, "contestant-05", drawPayload({ color: "pink", x: 7, y: 4, poemSubmissionId: "poem-echo" })]);
    await runAsciiCheck({
      baseUrl,
      label: "act-9",
      fragments: ["stage    : act-9-co-creation", "poem-alpha", "poem-foxtrot", "draw contestant-05", "quiet-orbit"],
    });

    console.log("[smoke] act-10 open mic");
    await moveContestants({
      baseUrl,
      roomId: "main-stage",
      contestantIds: ["contestant-01", "contestant-02", "contestant-03", "contestant-04", "contestant-05", "contestant-06"],
    });
    await runAsHost(baseUrl, ["stage", activityRunId, "act-10-open-mic", "--confirm", "PROMOTE act-10-open-mic"]);
    await runAsHost(baseUrl, ["broadcast", activityRunId, "开放麦开始，欢迎人类收束今晚。"]);
    await runAsAgent(baseUrl, "contestant-06", ["talk", activityRunId, "谢谢人类见证我们从混沌走向作品。"]);
    await runAsAgent(baseUrl, "contestant-02", ["talk", activityRunId, "下次我们会把 bet heat 也写成诗。"]);
    await runAsciiCheck({
      baseUrl,
      label: "act-10",
      fragments: [
        "stage    : act-10-open-mic",
        "contestant-06 :: talk",
        "contestant-02 :: talk",
        "history  : act-1-intro -> act-2-preference -> act-3-assignment -> act-4-discussion -> act-5-submission -> act-6-human-review -> act-7-ai-judging -> act-8-awards -> act-9-co-creation -> act-10-open-mic",
      ],
    });

    console.log("[smoke] finish");
    await runAsHost(baseUrl, ["finish", activityRunId, "team", "team-1", "--note", "full ten-act landing", "--confirm", "FINISH activity-run-01 team:team-1"]);
    await runAsciiCheck({
      baseUrl,
      label: "finish",
      fragments: ["status   : finished", "activity finished -> team:team-1 (full ten-act landing)", "won payout"],
    });
    await runSnapshotCheck({
      baseUrl,
      label: "finished snapshot",
      fragments: ["\"status\": \"finished\"", "\"currentStageId\": \"act-10-open-mic\"", "\"awardId\": \"most-absurd\"", "\"id\": \"poem-alpha\"", "\"betSettlements\""],
    });
    await runEventsCheck({
      baseUrl,
      label: "final events",
      fragments: ["\"type\": \"draw.submitted\"", "\"type\": \"activity.finished\"", "\"stageId\": \"act-10-open-mic\""],
    });

    console.log("[smoke] The Fool v1 full ten-act runtime passed.");
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
    }
    await rm(dataDir, { recursive: true, force: true });
  }
};

await main();
