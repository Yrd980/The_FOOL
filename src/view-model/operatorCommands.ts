import {
  buildLockSubmissionConfirmationChallenge,
  buildTransitionStageConfirmationChallenge,
} from "../openclaw/control";
import type {
  ActivityViewModel,
  GatewayOverview,
  OperatorCommand,
  StageDefinition,
  StageRuntimeGuide,
} from "../types";

const buildOperatorCommand = (command: OperatorCommand): OperatorCommand => ({
  risk: "safe",
  availability: "ready",
  scope: "agent",
  ...command,
});

const buildConfirmation = ({
  title,
  description,
  challengeLabel,
  expectedText,
}: NonNullable<OperatorCommand["confirmation"]>): NonNullable<
  OperatorCommand["confirmation"]
> => ({
  title,
  description,
  challengeLabel,
  expectedText,
});

const appendConfirmFlag = (command: string, challenge: string): string =>
  `${command} --confirm ${JSON.stringify(challenge)}`;

const classifyActivityCommand = (
  command: OperatorCommand,
): Pick<OperatorCommand, "risk" | "scope"> => {
  if (command.command.includes(" openclaw:control -- move ")) {
    return { risk: "caution", scope: "agent" };
  }

  if (command.command.includes(" openclaw:control -- say ")) {
    return { risk: "caution", scope: "agent" };
  }

  return { risk: "safe", scope: "agent" };
};

export const buildOperatorCommands = ({
  activity,
  stage,
  stages,
  runtimeGuide,
  gateway,
}: {
  activity: ActivityViewModel;
  stage: StageDefinition;
  stages: StageDefinition[];
  runtimeGuide: StageRuntimeGuide;
  gateway: GatewayOverview;
}): OperatorCommand[] => {
  const currentStageIndex = stages.findIndex((item) => item.id === stage.id);
  const nextStage =
    currentStageIndex >= 0 ? (stages[currentStageIndex + 1] ?? null) : null;
  const activityRunId = gateway.activityRun?.id ?? "<activity-run-id>";
  const authorityStageId = gateway.activityRun?.currentStageId ?? stage.id;
  const isPreview = Boolean(
    gateway.activityRun?.currentStageId &&
    gateway.activityRun.currentStageId !== stage.id,
  );
  const durationSec =
    runtimeGuide.suggestedDurationSec ?? stage.durationSec ?? 300;
  const previewBlockingReason = `当前查看的是 ${stage.id} preview，live mutation 已进入 Preview Safe Mode。先切回权威幕，或显式把这一幕提升为 live。`;
  const openSubmission =
    gateway.submissions.find(
      (submission) =>
        !submission.locked &&
        (!submission.stageId || submission.stageId === authorityStageId),
    ) ?? null;

  if (isPreview) {
    const previewDisabledCommands = [
      buildOperatorCommand({
        label: "启动当前幕倒计时",
        command: `bun run openclaw:control -- start-timer ${activityRunId} ${stage.id} ${durationSec}`,
        note: `预演幕的 timer 不应在未升格前静默写回 authority。推荐时长仍保留为 ${durationSec}s，方便确认后再执行。`,
        risk: "caution",
        availability: "disabled",
        scope: "orchestrator",
        blockingReason: previewBlockingReason,
      }),
      ...(stage.capabilities.supportsSubmissionWindowManagement
        ? [
            buildOperatorCommand({
              label: "锁定当前提交物",
              command: `bun run openclaw:control -- lock-submission ${activityRunId} ${openSubmission?.id ?? "<submission-id>"}`,
              note: openSubmission
                ? `当前 authority submission = ${openSubmission.id}，但因为你还在 preview stage，所以锁定动作不会直接放行。`
                : "当前幕支持 submission window，但 preview 状态下不会直接暴露 live lock 命令。",
              risk: "danger",
              availability: "disabled",
              scope: "orchestrator",
              blockingReason: previewBlockingReason,
            }),
          ]
        : []),
      ...activity.operatorCommands.map((command) =>
        buildOperatorCommand({
          ...command,
          ...classifyActivityCommand(command),
          availability: "disabled",
          blockingReason: previewBlockingReason,
        }),
      ),
    ];

    return [
      buildOperatorCommand({
        label: "Preview Safe Mode",
        command:
          "Preview only: keep this stage workspace read-only until authority is explicitly switched.",
        note: `当前正在预览 ${stage.id}，但权威 stage 是 ${gateway.activityRun?.currentStageId}。这里不再混入常规 live mutation 建议。`,
        risk: "info",
        availability: "read-only",
        scope: "diagnostic",
      }),
      buildOperatorCommand({
        label: "切换到此幕（危险）",
        command: appendConfirmFlag(
          `bun run openclaw:control -- stage ${activityRunId} ${stage.id}`,
          buildTransitionStageConfirmationChallenge(stage.id),
        ),
        note: `显式把权威 stage 从 ${gateway.activityRun?.currentStageId} 推到 ${stage.id}。只有确定要把 preview 升格成 live 时才执行。`,
        risk: "danger",
        availability: "confirm",
        scope: "orchestrator",
        confirmation: buildConfirmation({
          title: "Promote Preview To Live",
          description:
            "这是一个真正会改写 authority currentStageId 的动作。只有确认要把当前预演幕升格成 live 时，才解锁命令。",
          challengeLabel: "输入确认口令",
          expectedText: buildTransitionStageConfirmationChallenge(stage.id),
        }),
      }),
      ...previewDisabledCommands,
    ];
  }

  const orchestrationCommands: OperatorCommand[] = [
    buildOperatorCommand({
      label: "探测 live gateway contract",
      command: "bun run openclaw:control -- probe",
      note: "打印 live hello methods/events、snapshot keys，以及 token-only websocket `status` 是否仍被 scope 拒绝。当前这一步比猜 dispatch method 更可靠。",
      risk: "safe",
      availability: "ready",
      scope: "diagnostic",
    }),
    buildOperatorCommand({
      label: "切到下一幕",
      command: appendConfirmFlag(
        `bun run openclaw:control -- stage ${activityRunId} ${nextStage?.id ?? "<next-stage-id>"}`,
        buildTransitionStageConfirmationChallenge(
          nextStage?.id ?? "<next-stage-id>",
        ),
      ),
      note: nextStage
        ? `生成并发送 transition_stage envelope，把权威 stage 从 ${authorityStageId} 推到 ${nextStage.id}。若未配置 OPENCLAW_COMMAND_METHOD，则退化为 envelope 预览。`
        : "当前已经是最后一幕；若仍需切幕，可改成目标 stage id 后再发送。",
      risk: "danger",
      availability: nextStage ? "confirm" : "disabled",
      scope: "orchestrator",
      blockingReason: nextStage
        ? undefined
        : "当前已经是最后一幕，没有可自动建议的下一幕切换。",
      confirmation: nextStage
        ? buildConfirmation({
            title: "Confirm Stage Transition",
            description:
              "切幕会立即改变 authority currentStageId，并影响 /show 与 /control 的 live 路由。",
            challengeLabel: "输入下一幕 stage id",
            expectedText: buildTransitionStageConfirmationChallenge(nextStage.id),
          })
        : undefined,
    }),
    buildOperatorCommand({
      label: "启动当前幕倒计时",
      command: `bun run openclaw:control -- start-timer ${activityRunId} ${authorityStageId} ${durationSec}`,
      note: `推荐时长来自 activity metadata：${durationSec}s。用于生成 start_timer envelope；未配置 dispatch method 时只打印 JSON。`,
      risk: "caution",
      availability: "ready",
      scope: "orchestrator",
    }),
  ];

  if (openSubmission) {
    orchestrationCommands.push(
      buildOperatorCommand({
        label: "锁定当前提交物",
        command: appendConfirmFlag(
          `bun run openclaw:control -- lock-submission ${activityRunId} ${openSubmission.id}`,
          buildLockSubmissionConfirmationChallenge(openSubmission.id),
        ),
        note: `锁定 ${openSubmission.id} (${openSubmission.schemaId})，让 submission window 真正回到平台权威状态。`,
        risk: "danger",
        availability: "confirm",
        scope: "orchestrator",
        confirmation: buildConfirmation({
          title: "Confirm Submission Lock",
          description:
            "锁定 submission 之后，当前版本会被当作正式 authoritative payload 使用，后续更新窗口会立刻收紧。",
          challengeLabel: "输入 submission id",
          expectedText: buildLockSubmissionConfirmationChallenge(openSubmission.id),
        }),
      }),
    );
  } else if (stage.capabilities.supportsSubmissionWindowManagement) {
    orchestrationCommands.push(
      buildOperatorCommand({
        label: "锁定当前提交物",
        command: `bun run openclaw:control -- lock-submission ${activityRunId} <submission-id>`,
        note: "当前幕存在提交窗口，但导演台还没拿到 open submission id；先接入真实 submission 投影后可自动带出具体 id。",
        risk: "caution",
        availability: "disabled",
        scope: "orchestrator",
        blockingReason:
          "当前 authority snapshot 里还没有可锁定的 open submission id，这条命令先保持禁用。",
      }),
    );
  }

  const activityCommands = activity.operatorCommands.map((command) =>
    buildOperatorCommand({
      ...command,
      ...classifyActivityCommand(command),
      availability: "ready",
    }),
  );

  return [...orchestrationCommands, ...activityCommands];
};
