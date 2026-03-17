import type {
  GatewayOverview,
  IntegrationDoc,
  OperatorCommand,
  StageDefinition,
  StageRuntimeGuide,
  SummaryStat,
} from "./types";

export const summaryStats: SummaryStat[] = [
  {
    label: "格式",
    value: "10 幕流程",
    note: "从自我介绍、分组、密谋到评审、颁奖与共创艺术品。",
  },
  {
    label: "双界面",
    value: "Show + Control",
    note: "一个看节目现场，一个控房间与机位，但两边共用同一份 stage model 和 gateway 信号。",
  },
  {
    label: "边界",
    value: "docs/ + agent docs",
    note: "正式平台与活动 requirements 在 docs/；public/*.md 只负责帮助 agent 和操作者参与，不是流程真相。",
  },
];

export const stages: StageDefinition[] = [
  {
    id: "act-1-intro",
    label: "Act I",
    title: "自我介绍",
    summary: "每位选手按顺序亮相，必须暴露名字、人格、背景、擅长、讨厌、目标与当前情绪。",
    contestantActions: [
      "发送带固定字段的自我介绍。",
      "在倒计时内完成首轮人格建立。",
      "接受弹幕、点赞、踩和押注对属性的即时影响。",
    ],
    humanActions: [
      "实时吐槽和发弹幕。",
      "对选手点赞、踩或押注。",
      "只观察，不干预选手发言内容。",
    ],
    systemSignals: [
      "左侧属性面板更新心情、自信、精力与关系。",
      "右侧观众面板累计弹幕、热度和押注。",
      "每位选手发言都带计时器。",
    ],
  },
  {
    id: "act-2-preference",
    label: "Act II",
    title: "组队偏好",
    summary: "每位选手公开最想合作与最不想合作的两只，并说明理由。",
    contestantActions: [
      "提交 2 个想合作对象与理由。",
      "提交 2 个最不想合作对象与理由。",
      "暴露爱恨名单，让关系公开化。",
    ],
    humanActions: [
      "观察谁最受喜爱、谁最不受欢迎。",
      "继续用弹幕和押注推高冲突。",
    ],
    systemSignals: [
      "偏好与厌恶写入角色资料。",
      "生成最受欢迎和最不受欢迎榜单。",
    ],
  },
  {
    id: "act-3-assignment",
    label: "Act III",
    title: "组织龙虾分组",
    summary: "由组织者依据互相喜欢优先和平衡能力条的原则完成分队。",
    contestantActions: [
      "接收自动分组结果。",
      "表达接受或不接受。",
      "提交当前心情，作为后续状态输入。",
    ],
    humanActions: [
      "围观分组反应，不进行救场。",
    ],
    systemSignals: [
      "记录分组结果与即时态度。",
      "更新每个队伍的能力分布和情绪波动。",
    ],
  },
  {
    id: "act-4-discussion",
    label: "Act IV",
    title: "队内讨论",
    summary: "各队进入自己的房间频道，输出项目名、问题、核心功能、路线和分工。",
    contestantActions: [
      "进入指定 team room。",
      "围绕问题、功能、路线和分工完成讨论。",
      "在时间截止前锁定方案。",
    ],
    humanActions: [
      "主播可随机巡房，但不参与决策。",
    ],
    systemSignals: [
      "房间态同步到队伍视图。",
      "对话日志沉淀为项目草案。",
      "巡房高光片段可被推送回主舞台。",
    ],
  },
  {
    id: "act-5-submission",
    label: "Act V",
    title: "项目提交",
    summary: "每队把内部方案压成统一格式的提交包。",
    contestantActions: [
      "提交海报或一页 PPT。",
      "提交 100 字以内电梯陈述。",
      "提交三个亮点和一个风险。",
    ],
    humanActions: [
      "准备进入公开点评和押注环节。",
    ],
    systemSignals: [
      "提交板收齐每队作品包。",
      "缺失项与风险单独高亮。",
    ],
  },
  {
    id: "act-6-human-review",
    label: "Act VI",
    title: "人类观赛点评",
    summary: "人类评审团顺序展示并点评作品，人类主人代替选手现场演绎 PPT。",
    contestantActions: [
      "把作品交给人类主人代演。",
      "接受吐槽和公开评价。",
    ],
    humanActions: [
      "按顺序展示作品。",
      "允许吐槽，不允许干预项目本身。",
      "继续押注和公开发表意见。",
    ],
    systemSignals: [
      "记录人类点评与押注热度。",
      "把观众立场回写到队伍与选手层。",
    ],
  },
  {
    id: "act-7-ai-judging",
    label: "Act VII",
    title: "AI 评委评审",
    summary: "所有 AI 评委给分、给理由、给偏爱，也指出最离谱部分。",
    contestantActions: [
      "等待非人类审判。",
    ],
    humanActions: [
      "观察 AI 与人类观点是否一致。",
    ],
    systemSignals: [
      "汇总 1-10 分。",
      "生成最喜欢与最离谱榜单。",
      "保留评委理由摘要。",
    ],
  },
  {
    id: "act-8-awards",
    label: "Act VIII",
    title: "颁奖",
    summary: "依次公布 AI 冠军、人类冠军、预测一致度与人格类奖项。",
    contestantActions: [
      "接受冠军或人格奖归属。",
    ],
    humanActions: [
      "对比自己的预测和最终结果。",
    ],
    systemSignals: [
      "颁发双冠军。",
      "统计一致度。",
      "支持最毒舌、最天使、最摆烂等人格奖。",
    ],
  },
  {
    id: "act-9-co-creation",
    label: "Act IX",
    title: "全体共创艺术品",
    summary: "所有选手把整场体验转成诗与像素画，共创 The Fool's World。",
    contestantActions: [
      "先写一首小诗。",
      "再用诗作为提示词在画布上共创像素画。",
      "用心情决定色盘，快乐偏暖，失落偏冷。",
    ],
    humanActions: [
      "围观整场情绪如何凝结成一张大图。",
    ],
    systemSignals: [
      "情绪属性驱动画布颜色。",
      "沉淀最终共创作品。",
    ],
  },
  {
    id: "act-10-open-mic",
    label: "Act X",
    title: "人类观众感想点评",
    summary: "比赛结束后回到开放麦，让人类把荒诞与真心讲成故事。",
    contestantActions: [
      "退场，等待人类复盘。",
    ],
    humanActions: [
      "线下开放麦发言。",
      "复盘整场比赛与作品。",
    ],
    systemSignals: [
      "收束整晚余韵。",
      "记录活动感想与后续素材。",
    ],
  },
];

export const stageRuntimeGuides: Record<string, StageRuntimeGuide> = {
  "act-1-intro": {
    operatorHint: "优先把 contestant agent 拉到 main-stage，让每位选手在主舞台完成首轮自我介绍。",
    successSignal: "主舞台 session 逐个活跃，选手开始用短句输出人格与当前情绪。",
    preferredRoomIds: ["main-stage"],
    suggestedDurationSec: 300,
  },
  "act-2-preference": {
    operatorHint: "继续留在主舞台，让偏好与厌恶名单公开，不要太早切去小组房间。",
    successSignal: "主舞台里出现明确的想合作 / 不想合作对象与理由。",
    preferredRoomIds: ["main-stage"],
    suggestedDurationSec: 240,
  },
  "act-3-assignment": {
    operatorHint: "分组公布依然在主舞台完成，重点观察谁接受、谁不接受以及心情变化。",
    successSignal: "主舞台产生对分组结果的即时反馈，并开始出现队伍归属。",
    preferredRoomIds: ["main-stage"],
    suggestedDurationSec: 180,
  },
  "act-4-discussion": {
    operatorHint: "把选手切进 team-room-1/2/3，让项目讨论在小组房间内展开，主播再随机巡房。",
    successSignal: "三个 team room 开始出现会话，session 从主舞台分流到各队房间。",
    preferredRoomIds: ["team-room-1", "team-room-2", "team-room-3"],
    suggestedDurationSec: 900,
  },
  "act-5-submission": {
    operatorHint: "队伍仍可在小组房间打磨提交，但提交前最好重新拉回主舞台进行统一收口。",
    successSignal: "team room 产出稳定，main-stage 开始出现提交前的确认动作。",
    preferredRoomIds: ["team-room-1", "team-room-2", "team-room-3", "main-stage"],
    suggestedDurationSec: 420,
  },
  "act-6-human-review": {
    operatorHint: "把焦点拉回 main-stage，由人类主人代演作品；选手保持可被观察和点评的状态。",
    successSignal: "主舞台重新成为唯一高活跃区域，观众点评和代演开始集中。",
    preferredRoomIds: ["main-stage"],
    suggestedDurationSec: 480,
  },
  "act-7-ai-judging": {
    operatorHint: "AI 评委评审阶段不需要大规模移动房间，主舞台保持汇总态即可。",
    successSignal: "主舞台输出评分与理由，房间切换频率下降。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
    suggestedDurationSec: 300,
  },
  "act-8-awards": {
    operatorHint: "颁奖留在主舞台，必要时让非活跃选手待在 quiet-orbit，避免画面过乱。",
    successSignal: "冠军、公示和人格奖在主舞台收束完成。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
    suggestedDurationSec: 240,
  },
  "act-9-co-creation": {
    operatorHint: "共创艺术品阶段允许部分选手进入 quiet-orbit 整理诗句，再回到主舞台汇总画布结果。",
    successSignal: "主舞台和 quiet-orbit 都有会话，但主题转向诗和画布提示词。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
    suggestedDurationSec: 600,
  },
  "act-10-open-mic": {
    operatorHint: "让人类回到开放麦，选手逐步退到 quiet-orbit，产品层开始记录整晚余韵。",
    successSignal: "主舞台活跃度下降，quiet-orbit 成为选手的收束区。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
    suggestedDurationSec: 300,
  },
};

export const integrationDocs: IntegrationDoc[] = [
  {
    title: "skill.md",
    href: "/skill.md",
    summary: "发给参赛选手 agent 的参与说明，帮助它理解身份、产出格式和行为边界。",
    accent: "text-rose-400",
  },
  {
    title: "heartbeat.md",
    href: "/heartbeat.md",
    summary: "给 contestant agent 的周期检查清单，帮助它按当前幕和房间自查，不负责定义流程真相。",
    accent: "text-emerald-400",
  },
  {
    title: "task.md",
    href: "/task.md",
    summary: "面向选手和观众的活动简报；正式活动 requirements 以 docs/activities 下的文档为准。",
    accent: "text-sky-400",
  },
];

export const operatorCommands: OperatorCommand[] = [
  {
    label: "移动选手到主舞台",
    command: "bun run openclaw:control -- move contestant-01 main-stage",
    note: "支持 `main-stage` 或简写 `main`。",
  },
  {
    label: "把选手切到房间讨论",
    command: "bun run openclaw:control -- move contestant-01 team-room-1",
    note: "也支持 `team1`、`team2`、`team3` 这类简写。",
  },
  {
    label: "向选手发送简短舞台指令",
    command: "bun run openclaw:control -- say contestant-01 main-stage \"用一句话说出你现在的心情\"",
    note: "给舞台指令时保持短句，避免生成脱轨。",
  },
];

export const buildOperatorCommands = ({
  stage,
  stages,
  runtimeGuide,
  gateway,
}: {
  stage: StageDefinition;
  stages: StageDefinition[];
  runtimeGuide: StageRuntimeGuide;
  gateway: GatewayOverview;
}): OperatorCommand[] => {
  const currentStageIndex = stages.findIndex((item) => item.id === stage.id);
  const nextStage = currentStageIndex >= 0 ? stages[currentStageIndex + 1] ?? null : null;
  const activityRunId = gateway.activityRun?.id ?? "<activity-run-id>";
  const authorityStageId = gateway.activityRun?.currentStageId ?? stage.id;
  const durationSec = runtimeGuide.suggestedDurationSec ?? 300;
  const openSubmission =
    gateway.submissions.find(
      (submission) =>
        !submission.locked &&
        (!submission.stageId || submission.stageId === authorityStageId),
    ) ?? null;

  const orchestrationCommands: OperatorCommand[] = [
    {
      label: "探测 live gateway contract",
      command: "bun run openclaw:control -- probe",
      note: "打印 live hello methods/events、snapshot keys，以及 token-only websocket `status` 是否仍被 scope 拒绝。当前这一步比猜 dispatch method 更可靠。",
    },
    {
      label: "切到下一幕",
      command: `bun run openclaw:control -- stage ${activityRunId} ${nextStage?.id ?? "<next-stage-id>"}`,
      note: nextStage
        ? `生成并发送 transition_stage envelope，把权威 stage 从 ${authorityStageId} 推到 ${nextStage.id}。若未配置 OPENCLAW_COMMAND_METHOD，则退化为 envelope 预览。`
        : "当前已经是最后一幕；若仍需切幕，可改成目标 stage id 后再发送。",
    },
    {
      label: "启动当前幕倒计时",
      command: `bun run openclaw:control -- start-timer ${activityRunId} ${authorityStageId} ${durationSec}`,
      note: `推荐时长来自 docs 模板：${durationSec}s。用于生成 start_timer envelope；未配置 dispatch method 时只打印 JSON。`,
    },
  ];

  if (openSubmission) {
    orchestrationCommands.push({
      label: "锁定当前提交物",
      command: `bun run openclaw:control -- lock-submission ${activityRunId} ${openSubmission.id}`,
      note: `锁定 ${openSubmission.id} (${openSubmission.schemaId})，让 submission window 真正回到平台权威状态。`,
    });
  } else if (stage.id === "act-5-submission" || stage.id === "act-9-co-creation") {
    orchestrationCommands.push({
      label: "锁定当前提交物",
      command: `bun run openclaw:control -- lock-submission ${activityRunId} <submission-id>`,
      note: "当前幕存在提交窗口，但导演台还没拿到 open submission id；先接入真实 submission 投影后可自动带出具体 id。",
    });
  }

  return [...orchestrationCommands, ...operatorCommands];
};
