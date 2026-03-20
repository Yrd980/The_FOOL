import type {
  ActivityRoomSceneRole,
  ActivityStageMetadata,
  ActivityStageSpotlightSource,
} from "../openclaw/activityMetadata";
import { tryResolveActivityPackage } from "../openclaw/activityRuntime";
import type {
  ActivityViewModel,
  IntegrationDoc,
  StageDefinition,
  StageRuntimeGuide,
  SummaryStat,
} from "../types";

const PENDING_ACTIVITY_PACKAGE_ID = "openclaw:pending-activity";
const PENDING_STAGE_ID = "activity-pending";

const buildFallbackStageMetadata = (
  stage: StageDefinition,
): ActivityStageMetadata => ({
  summary: `${stage.title} 的活动说明尚未提供专属前端 copy。`,
  contestantActions: ["按当前活动规则完成这一幕的核心动作。"],
  humanActions: ["观察 authority state，并在允许范围内参与。"],
  systemSignals: ["当前幕的 operator cue 将在 activity metadata 完整后补齐。"],
  operatorHint: `优先让现场跟着 ${stage.title} 的权威状态推进。`,
  successSignal: `${stage.title} 的 stage-specific 成功信号还未在活动包里声明。`,
  preferredRoomIds: [],
  scene: {
    deskMode: stage.presentation.deskMode,
    layoutPreset: stage.presentation.layoutPreset ?? undefined,
    spotlightSource: stage.presentation.spotlightSource,
    heatAsTieBreaker: stage.presentation.heatAsTieBreaker,
  },
});

const buildStageDefinition = ({
  stageId,
  label,
  name,
  summary,
  contestantActions,
  humanActions,
  systemSignals,
  allowedActions,
  submissionSchemaIds,
  durationSec,
  deskMode,
  layoutPreset,
  spotlightSource,
  heatAsTieBreaker,
}: {
  stageId: string;
  label: string;
  name: string;
  summary: string;
  contestantActions: string[];
  humanActions: string[];
  systemSignals: string[];
  allowedActions: string[];
  submissionSchemaIds?: string[];
  durationSec?: number;
  deskMode: StageDefinition["presentation"]["deskMode"];
  layoutPreset?: string;
  spotlightSource: ActivityStageSpotlightSource;
  heatAsTieBreaker: boolean;
}): StageDefinition => ({
  id: stageId,
  label,
  title: name,
  summary,
  contestantActions,
  humanActions,
  systemSignals,
  allowedActions,
  submissionSchemaIds: submissionSchemaIds ?? [],
  durationSec,
  capabilities: {
    hasSubmissionSchema: (submissionSchemaIds?.length ?? 0) > 0,
    supportsSubmissionWindowManagement: allowedActions.some((action) =>
      ["open_submission", "update_submission", "lock_submission"].includes(
        action,
      ),
    ),
    supportsScoring:
      allowedActions.includes("score") ||
      allowedActions.includes("submit_score"),
    supportsAwards: allowedActions.includes("grant_award"),
  },
  presentation: {
    deskMode,
    layoutPreset: layoutPreset?.trim() || null,
    spotlightSource,
    heatAsTieBreaker,
  },
});

const buildStageRuntimeGuide = ({
  operatorHint,
  successSignal,
  preferredRoomIds,
  durationSec,
  roomRoles,
  layoutPreset,
  spotlightSource,
  heatAsTieBreaker,
}: {
  operatorHint: string;
  successSignal: string;
  preferredRoomIds?: string[];
  durationSec?: number;
  roomRoles: Record<string, ActivityRoomSceneRole>;
  layoutPreset?: string;
  spotlightSource: ActivityStageSpotlightSource;
  heatAsTieBreaker: boolean;
}): StageRuntimeGuide => ({
  operatorHint,
  successSignal,
  preferredRoomIds: preferredRoomIds ?? [],
  suggestedDurationSec: durationSec,
  roomRoles,
  scene: {
    layoutPreset: layoutPreset?.trim() || null,
    spotlightSource,
    heatAsTieBreaker,
  },
});

const buildFallbackSummaryStats = (stageCount: number): SummaryStat[] => [
  {
    label: "格式",
    value: `${stageCount} 幕流程`,
    note: "当前活动的前端 view model 直接从 activity package 组装。",
  },
  {
    label: "双界面",
    value: "Show + Control",
    note: "观众和导演视图消费同一份 authority + activity metadata。",
  },
  {
    label: "边界",
    value: "activity-driven",
    note: "活动 copy、room alias、stage cue 不再写死在 renderer 静态数组里。",
  },
];

const buildFallbackIntegrationDocs = (): IntegrationDoc[] => [
  {
    title: "skill.md",
    href: "/skill.md",
    summary: "当前活动的 agent 参与说明。",
    accent: "text-rose-400",
  },
  {
    title: "heartbeat.md",
    href: "/heartbeat.md",
    summary: "当前活动的 heartbeat / 自检文档。",
    accent: "text-emerald-400",
  },
];

const buildPendingStageDefinition = (
  fallbackStageId?: string | null,
): StageDefinition => {
  const normalizedStageId = fallbackStageId?.trim() || PENDING_STAGE_ID;
  const hasAuthorityStage = Boolean(fallbackStageId?.trim());

  return {
    id: normalizedStageId,
    label: hasAuthorityStage ? "Authority Stage" : "Bootstrap Pending",
    title: hasAuthorityStage ? normalizedStageId : "Awaiting Activity Template",
    summary: hasAuthorityStage
      ? `平台已经声明当前 stage 为 ${normalizedStageId}，但前端还没拿到对应 activity package，所以这里不会默认套用任何其他活动的前台文案。`
      : "authority template 和 preview stage 目前都还没装配完成，renderer 先保持通用 pending shell。",
    contestantActions: [
      hasAuthorityStage
        ? "继续按权威 stage 推进，等待 activity package 接入后补齐活动 copy。"
        : "等待平台或 preview route 明确当前活动。",
    ],
    humanActions: [
      "观察 authority snapshot / query 是否已经给出 templateId、stageId 和技能绑定。",
    ],
    systemSignals: [
      "活动包显式解析成功前，不再默认套用任何 reference activity 前台文案。",
    ],
    allowedActions: [],
    submissionSchemaIds: [],
    capabilities: {
      hasSubmissionSchema: false,
      supportsSubmissionWindowManagement: false,
      supportsScoring: false,
      supportsAwards: false,
    },
    presentation: {
      deskMode: "submission",
      layoutPreset: null,
      spotlightSource: "submission",
      heatAsTieBreaker: true,
    },
  };
};

const buildPendingActivityViewModel = ({
  requestedActivityPackageId,
  fallbackStageId,
}: {
  requestedActivityPackageId?: string | null;
  fallbackStageId?: string | null;
}): ActivityViewModel => {
  const stage = buildPendingStageDefinition(fallbackStageId);
  const templateCopy = requestedActivityPackageId?.trim()
    ? `当前 authority templateId = ${requestedActivityPackageId.trim()}，但本地 registry 里还没有对应 activity package。`
    : "当前 authority templateId 还不可用。";

  return {
    packageId:
      requestedActivityPackageId?.trim() || PENDING_ACTIVITY_PACKAGE_ID,
    badgeLabel: "OpenClaw / Activity Pending",
    title: "OpenClaw Activity Pending",
    description: `${templateCopy} 前端先展示通用待装配壳，不再默认长成某个 reference activity。`,
    defaultStageId: stage.id,
    stages: [stage],
    stageRuntimeGuides: {
      [stage.id]: buildStageRuntimeGuide({
        operatorHint:
          "先以 authority stage / world / skills 为准，等 activity package 注册完成后再接入活动专属 copy。",
        successSignal:
          "一旦拿到已注册 templateId，对应 stage copy、room roles 和 operator cue 会自动接管当前视图。",
        preferredRoomIds: [],
        roomRoles: {},
        layoutPreset: undefined,
        spotlightSource: "submission",
        heatAsTieBreaker: true,
      }),
    },
    summaryStats: [
      {
        label: "状态",
        value: "Pending Activity",
        note: "当前 renderer 只消费 authority signal，不再把未知活动默认渲染成某个已注册活动。",
      },
      {
        label: "来源",
        value: requestedActivityPackageId?.trim() || "awaiting authority",
        note: "templateId 解析成功前，activity-specific docs 和 scene cue 都保持未装配。",
      },
      {
        label: "边界",
        value: "platform-first",
        note: "未知 authority 不再偷用 reference activity 作为前台真相。",
      },
    ],
    integrationDocs: buildFallbackIntegrationDocs(),
    operatorCommands: [],
  };
};

export const buildActivityViewModel = ({
  activityPackageId,
  requestedActivityPackageId,
  fallbackStageId,
}: {
  activityPackageId?: string | null;
  requestedActivityPackageId?: string | null;
  fallbackStageId?: string | null;
} = {}): ActivityViewModel => {
  const activityPackage = tryResolveActivityPackage(activityPackageId);
  if (!activityPackage) {
    return buildPendingActivityViewModel({
      requestedActivityPackageId,
      fallbackStageId,
    });
  }

  const metadata = activityPackage.metadata;
  const roomRoles = (metadata?.rooms?.roles ?? []).reduce<
    Record<string, ActivityRoomSceneRole>
  >((result, roomRole) => {
    result[roomRole.roomId] = roomRole.role;
    return result;
  }, {});
  const stages = activityPackage.stageTemplates.map((stageTemplate, index) => {
    const stageLabel =
      metadata?.stages[stageTemplate.id]?.label?.trim() || `Stage ${index + 1}`;
    const stageMetadata =
      metadata?.stages[stageTemplate.id] ??
      buildFallbackStageMetadata({
        id: stageTemplate.id,
        label: stageLabel,
        title: stageTemplate.name,
        summary: `${stageTemplate.name} 的活动说明尚未提供专属前端 copy。`,
        contestantActions: [],
        humanActions: [],
        systemSignals: [],
        allowedActions: stageTemplate.allowedActions,
        submissionSchemaIds: stageTemplate.submissionSchemaIds ?? [],
        durationSec: stageTemplate.durationSec,
        capabilities: {
          hasSubmissionSchema: false,
          supportsSubmissionWindowManagement: false,
          supportsScoring: false,
          supportsAwards: false,
        },
        presentation: {
          deskMode: "submission",
          layoutPreset: null,
          spotlightSource: "submission",
          heatAsTieBreaker: true,
        },
      });
    const deskMode =
      stageMetadata.scene?.deskMode ??
      (stageTemplate.allowedActions.includes("score") ||
      stageTemplate.allowedActions.includes("submit_score") ||
      stageTemplate.allowedActions.includes("grant_award")
        ? "score"
        : "submission");
    const spotlightSource =
      stageMetadata.scene?.spotlightSource ??
      (stageTemplate.allowedActions.includes("grant_award")
        ? "award"
        : stageTemplate.allowedActions.includes("score") ||
            stageTemplate.allowedActions.includes("submit_score")
          ? "score"
          : stageTemplate.allowedActions.includes("draw")
            ? "co-creation"
            : stageTemplate.allowedActions.some((action) =>
                  ["submit", "update_submission", "lock_submission"].includes(
                    action,
                  ),
                )
              ? "submission"
              : stageMetadata.preferredRoomIds?.length
                ? "room"
                : "speaker");
    const heatAsTieBreaker = stageMetadata.scene?.heatAsTieBreaker ?? true;

    return buildStageDefinition({
      stageId: stageTemplate.id,
      label: stageLabel,
      name: stageTemplate.name,
      summary: stageMetadata.summary,
      contestantActions: stageMetadata.contestantActions,
      humanActions: stageMetadata.humanActions,
      systemSignals: stageMetadata.systemSignals,
      allowedActions: stageTemplate.allowedActions,
      submissionSchemaIds: stageTemplate.submissionSchemaIds,
      durationSec: stageTemplate.durationSec,
      deskMode,
      layoutPreset: stageMetadata.scene?.layoutPreset,
      spotlightSource,
      heatAsTieBreaker,
    });
  });

  const stageRuntimeGuides = stages.reduce<Record<string, StageRuntimeGuide>>(
    (result, stage) => {
      const stageMetadata =
        metadata?.stages[stage.id] ?? buildFallbackStageMetadata(stage);
      result[stage.id] = buildStageRuntimeGuide({
        operatorHint: stageMetadata.operatorHint,
        successSignal: stageMetadata.successSignal,
        preferredRoomIds: stageMetadata.preferredRoomIds,
        durationSec: stage.durationSec,
        roomRoles,
        layoutPreset: stage.presentation.layoutPreset ?? undefined,
        spotlightSource: stage.presentation.spotlightSource,
        heatAsTieBreaker: stage.presentation.heatAsTieBreaker,
      });
      return result;
    },
    {},
  );

  return {
    packageId: activityPackage.id,
    badgeLabel: metadata?.badgeLabel ?? activityPackage.id,
    title: metadata?.title ?? activityPackage.id,
    description:
      metadata?.description ??
      "当前前端 view model 还没有活动专属描述，暂时直接消费平台 authority state。",
    defaultStageId:
      activityPackage.initialStageId ??
      activityPackage.stageTemplates[0]?.id ??
      null,
    stages,
    stageRuntimeGuides,
    summaryStats:
      metadata?.summaryStats ??
      buildFallbackSummaryStats(activityPackage.stageTemplates.length),
    integrationDocs:
      metadata?.integrationDocs ?? buildFallbackIntegrationDocs(),
    operatorCommands: metadata?.operatorCommands ?? [],
  };
};

export {
  buildFallbackIntegrationDocs,
  buildFallbackStageMetadata,
};
