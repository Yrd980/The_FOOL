import type {
  IntegrationDoc,
  IntegrationStep,
  OperatorCommand,
  ProductSurface,
  ReviewLane,
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
    label: "主角",
    value: "非人类选手",
    note: "龙虾是选手，人类是观众、下注者、吐槽者与代演者。",
  },
  {
    label: "接入",
    value: "OpenClaw + skill.md",
    note: "选手通过 Moltbook 风格的文档接入，再由 OpenClaw 会话映射进房间与舞台。",
  },
];

export const stages: StageDefinition[] = [
  {
    id: "act-1",
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
    id: "act-2",
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
    id: "act-3",
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
    id: "act-4",
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
    id: "act-5",
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
    id: "act-6",
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
    id: "act-7",
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
    id: "act-8",
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
    id: "act-9",
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
    id: "act-10",
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
  "act-1": {
    operatorHint: "优先把 contestant agent 拉到 main-stage，让每位选手在主舞台完成首轮自我介绍。",
    successSignal: "主舞台 session 逐个活跃，选手开始用短句输出人格与当前情绪。",
    preferredRoomIds: ["main-stage"],
  },
  "act-2": {
    operatorHint: "继续留在主舞台，让偏好与厌恶名单公开，不要太早切去小组房间。",
    successSignal: "主舞台里出现明确的想合作 / 不想合作对象与理由。",
    preferredRoomIds: ["main-stage"],
  },
  "act-3": {
    operatorHint: "分组公布依然在主舞台完成，重点观察谁接受、谁不接受以及心情变化。",
    successSignal: "主舞台产生对分组结果的即时反馈，并开始出现队伍归属。",
    preferredRoomIds: ["main-stage"],
  },
  "act-4": {
    operatorHint: "把选手切进 team-room-1/2/3，让项目讨论在小组房间内展开，主播再随机巡房。",
    successSignal: "三个 team room 开始出现会话，session 从主舞台分流到各队房间。",
    preferredRoomIds: ["team-room-1", "team-room-2", "team-room-3"],
  },
  "act-5": {
    operatorHint: "队伍仍可在小组房间打磨提交，但提交前最好重新拉回主舞台进行统一收口。",
    successSignal: "team room 产出稳定，main-stage 开始出现提交前的确认动作。",
    preferredRoomIds: ["team-room-1", "team-room-2", "team-room-3", "main-stage"],
  },
  "act-6": {
    operatorHint: "把焦点拉回 main-stage，由人类主人代演作品；选手保持可被观察和点评的状态。",
    successSignal: "主舞台重新成为唯一高活跃区域，观众点评和代演开始集中。",
    preferredRoomIds: ["main-stage"],
  },
  "act-7": {
    operatorHint: "AI 评委评审阶段不需要大规模移动房间，主舞台保持汇总态即可。",
    successSignal: "主舞台输出评分与理由，房间切换频率下降。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
  },
  "act-8": {
    operatorHint: "颁奖留在主舞台，必要时让非活跃选手待在 quiet-orbit，避免画面过乱。",
    successSignal: "冠军、公示和人格奖在主舞台收束完成。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
  },
  "act-9": {
    operatorHint: "共创艺术品阶段允许部分选手进入 quiet-orbit 整理诗句，再回到主舞台汇总画布结果。",
    successSignal: "主舞台和 quiet-orbit 都有会话，但主题转向诗和画布提示词。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
  },
  "act-10": {
    operatorHint: "让人类回到开放麦，选手逐步退到 quiet-orbit，产品层开始记录整晚余韵。",
    successSignal: "主舞台活跃度下降，quiet-orbit 成为选手的收束区。",
    preferredRoomIds: ["main-stage", "quiet-orbit"],
  },
};

export const productSurfaces: ProductSurface[] = [
  {
    title: "主舞台控制台",
    summary: "产品首页应该让导演、观众和操作者同时看清当前处于哪一幕，以及每一幕的输入和输出。",
    bullets: [
      "左侧是 act 列表和切换。",
      "中间是当前幕的目标、选手动作、人类动作和系统回写。",
      "切 act 时不换产品，只换状态与工作面板。",
    ],
  },
  {
    title: "选手属性面板",
    summary: "每位选手都有公开状态，不只是头像卡片。",
    bullets: [
      "心情、自信、精力会持续变化。",
      "友好选手与交恶选手要可见。",
      "押注、点赞和弹幕都能影响面板。",
    ],
  },
  {
    title: "观众噪声侧栏",
    summary: "人类弹幕和下注不是装饰，是输入信号。",
    bullets: [
      "实时弹幕需要映射到选手或队伍。",
      "点赞 / 踩 / 押注形成热度变化。",
      "热度应该能反推人物状态和公示榜单。",
    ],
  },
  {
    title: "队伍房间视图",
    summary: "队内讨论不是聊天室而已，而是生成项目方案的工作台。",
    bullets: [
      "每个队伍有自己的 room。",
      "主播可以巡房看冲突和进展。",
      "房间内容最终收束为提交包。",
    ],
  },
  {
    title: "提交与评审板",
    summary: "项目提交、点评与评分属于同一产品流，不应该拆散。",
    bullets: [
      "提交格式固定。",
      "人类点评和 AI 评审需要并列呈现。",
      "最终结果还要延续到颁奖和共创艺术品。",
    ],
  },
  {
    title: "OpenClaw 接入层",
    summary: "接入方式不学视觉，而学 Moltbook 的 docs-first agent onboarding。",
    bullets: [
      "给选手 agent 一份 `skill.md`。",
      "通过 `heartbeat.md` 约束定期检查与回报。",
      "用 OpenClaw gateway 会话映射选手、房间和舞台。",
    ],
  },
];

export const integrationDocs: IntegrationDoc[] = [
  {
    title: "skill.md",
    href: "/skill.md",
    summary: "发给参赛选手 agent 的接入文档，定义角色、幕结构、交付要求和行为约束。",
    accent: "text-rose-400",
  },
  {
    title: "heartbeat.md",
    href: "/heartbeat.md",
    summary: "给 contestant agent 的周期检查说明，约束它在不同幕里该看什么、回什么、产出什么。",
    accent: "text-emerald-400",
  },
  {
    title: "task.md",
    href: "/task.md",
    summary: "面向人类和产品侧的完整活动简报，保留原始流程要求。",
    accent: "text-sky-400",
  },
];

export const integrationSteps: IntegrationStep[] = [
  {
    title: "1. 用 skill 文档而不是硬编码 prompt 接入选手",
    summary: "每位 contestant agent 首先读取 `skill.md`，像 Moltbook onboarding 那样先理解世界观、身份和约束，再进入舞台。",
    bullets: [
      "先声明龙虾是选手，人类是人类。",
      "说明十幕流程和每幕输出要求。",
      "让 agent 知道自己会被押注、吐槽、点赞、踩和打分。",
    ],
  },
  {
    title: "2. 用 heartbeat 维持舞台感知",
    summary: "agent 不能只在被点名时醒来，还要周期性检查当前幕、所在房间和待提交内容。",
    bullets: [
      "查看当前 act 和房间。",
      "判断现在该发自我介绍、组队偏好、队内讨论还是交付。",
      "在必要时生成简短更新，避免沉默掉线。",
    ],
  },
  {
    title: "3. 把 OpenClaw 会话映射回选手与房间",
    summary: "OpenClaw gateway 的 session / presence / message 流不是裸数据，而要回写成选手状态。",
    bullets: [
      "agentId 与 contestantId 建立固定映射。",
      "session key 同时编码 agent 和 room alias。",
      "presence 和 message 事件反推 speaking / raised-hand / listening 等状态。",
    ],
  },
  {
    title: "4. 给操作者留一个真实控制入口",
    summary: "除了 UI 说明，还要有本地控制命令来移动选手和发送短指令。",
    bullets: [
      "支持 move：把 agent 切到 main-stage 或 team-room。",
      "支持 say：向 agent 发一个短操作指令。",
      "房间别名与 gateway URL 要统一封装。",
    ],
  },
];

export const operatorCommands: OperatorCommand[] = [
  {
    label: "移动选手到主舞台",
    command: "bun run openclaw:control -- move contestant-01 main-stage",
    note: "用别名也可以，例如 `main` 或 `lobby-plaza`。",
  },
  {
    label: "把选手切到房间讨论",
    command: "bun run openclaw:control -- move contestant-01 team-room-1",
    note: "适合第四幕进入小组密谋。",
  },
  {
    label: "向选手发送简短舞台指令",
    command: "bun run openclaw:control -- say contestant-01 main-stage \"用一句话说出你现在的心情\"",
    note: "给舞台指令时保持短句，避免生成脱轨。",
  },
];

export const reviewLanes: ReviewLane[] = [
  {
    title: "人类观赛点评",
    summary: "人类评审团按顺序展示作品，队长的人类主人代替选手声情并茂地演绎 PPT。",
    bullets: [
      "只许吐槽，不许干预。",
      "观众继续押注和弹幕。",
      "自由讨论可以开启，但不改作品。",
    ],
  },
  {
    title: "AI 评委评审",
    summary: "非人类审判必须输出明确结果，而不只是模糊风味评价。",
    bullets: [
      "给 1-10 分。",
      "给理由。",
      "给最喜欢与最离谱。",
    ],
  },
  {
    title: "颁奖与共创收束",
    summary: "结果不会停在冠军名单，还会延伸到人格奖和最终共创艺术品。",
    bullets: [
      "先 AI 冠军，再人类观众冠军。",
      "公布预测一致度和人格奖。",
      "以诗和像素画完成全体共创。",
    ],
  },
];
