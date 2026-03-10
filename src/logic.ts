import type {
  AiJudge,
  AiReview,
  AiTeamSummary,
  AudienceInteraction,
  AudienceOverview,
  AwardSummary,
  Contestant,
  ContestantPoem,
  ContestantReaction,
  ContestantScorecard,
  HumanJudge,
  HumanReview,
  PixelBoard,
  PixelCell,
  SkillAxis,
  SkillVector,
  StageAward,
  TeamDiscussionMessage,
  TeamRoleAssignment,
  TeamSubmission,
  TeamSummary,
} from "./types";

const SKILL_AXES: SkillAxis[] = ["strategy", "craft", "story", "execution"];

const TEAM_IDENTITIES = [
  { name: "逆光潮汐组", theme: "把观众情绪编进舞台叙事", accent: "#ff8a63" },
  { name: "硬壳回路组", theme: "给离谱创意焊上一套可运行骨架", accent: "#68d4d0" },
  { name: "偏航诗学组", theme: "让策略、表演和余韵在同一屏发光", accent: "#ad87ff" },
  { name: "火花抢修组", theme: "用冲刺速度把事故做成高光", accent: "#ff657b" },
];

const AXIS_LABELS: Record<SkillAxis, string> = {
  strategy: "规则设计与产品取舍",
  craft: "原型表现与交互质感",
  story: "叙事包装与传播魅力",
  execution: "交付推进与压线落地",
};

const AXIS_CONTENT: Record<
  SkillAxis,
  {
    nouns: string[];
    problem: string;
    features: string[];
    routes: string[];
    risks: string[];
  }
> = {
  strategy: {
    nouns: ["押注路由器", "关系编排台", "舞台总控局", "情绪分流器"],
    problem: "综艺式黑客松很热闹，但缺少一套能把关系、押注和节奏同时收束的中控工具。",
    features: [
      "让选手偏好、弹幕和押注共同影响舞台推进",
      "用实时榜单暴露联盟、冲突和风险点",
      "把十幕流程浓缩成可操控的总控台",
    ],
    routes: ["先锁规则层", "再接舞台事件流", "最后把结果压成可展示闭环"],
    risks: ["如果规则解释过多，观众会先被信息量压住。"],
  },
  craft: {
    nouns: ["原型熔炉", "情绪界面柜", "像素放映机", "高光装配线"],
    problem: "好点子常常输在呈现粗糙，观众来不及看懂就已经错过高光。",
    features: [
      "把选手状态和观众动作做成同屏反馈",
      "用房间讨论直接生成项目提交卡",
      "让像素共创艺术成为可视化收尾",
    ],
    routes: ["先做舞台主视图", "再做队伍房间和提交卡", "最后收一块能记住的像素画"],
    risks: ["过度追求表层好看，可能稀释作品重心。"],
  },
  story: {
    nouns: ["余波剧场", "海报引擎", "命运导播台", "节目文案器"],
    problem: "很多项目能跑，却没有一句能让人类带出会场继续讲的句子。",
    features: [
      "为每一幕生成可传播的节目感描述",
      "把选手性格和作品主题绑定成强记忆点",
      "让评审理由同时具备判断和戏剧性",
    ],
    routes: ["先抓人设", "再写队伍主叙事", "最后把冠军和人格奖讲成完整故事"],
    risks: ["如果叙事野心过大，可能压过功能真相。"],
  },
  execution: {
    nouns: ["冲刺塔台", "截止日焊枪", "压线折叠屏", "交付警报器"],
    problem: "再好的创意，如果无法在时间内稳定落地，就只剩下遗憾和借口。",
    features: [
      "自动整理分工、路线和提交内容",
      "以倒计时和风险项牵引冲刺节奏",
      "让真正能跑起来的方案在评审中被看见",
    ],
    routes: ["先定 MVP", "再对齐分工", "最后以风险提示收尾"],
    risks: ["过分强调交付，可能让作品失去锋利感。"],
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const sumSkills = (members: ContestantScorecard[]): SkillVector =>
  members.reduce<SkillVector>(
    (acc, member) => ({
      strategy: acc.strategy + member.skills.strategy,
      craft: acc.craft + member.skills.craft,
      story: acc.story + member.skills.story,
      execution: acc.execution + member.skills.execution,
    }),
    { strategy: 0, craft: 0, story: 0, execution: 0 },
  );

const dominantAxes = (skills: SkillVector) =>
  [...SKILL_AXES].sort((left, right) => skills[right] - skills[left]);

const topAxis = (skills: SkillVector) => dominantAxes(skills)[0];

const varianceScore = (skills: SkillVector) => {
  const values = SKILL_AXES.map((axis) => skills[axis]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;

  return clamp(100 - Math.sqrt(variance) * 2.3, 46, 98);
};

const buildAvatarGlyph = (name: string) => {
  if (name.length >= 2) {
    return `${name[0]}${name[name.length - 1]}`;
  }

  return `${name}${name}`;
};

const buildMoodLabel = (
  contestant: Contestant,
  likes: number,
  boos: number,
  bets: number,
  danmakuCount: number,
) => {
  const delta = likes * 4.2 - boos * 4.8 + bets * 0.16 + danmakuCount * 2.4;

  if (delta >= 8) {
    return `被观众点燃：${contestant.currentMoment}`;
  }
  if (delta <= -4) {
    return `被人类挑衅：${contestant.currentMoment}`;
  }

  return `舞台平衡中：${contestant.currentMoment}`;
};

const relationshipScore = (source: ContestantScorecard, targetId: string) => {
  let score = 0;

  if (source.preferences.want.some((choice) => choice.contestantId === targetId)) {
    score += 2;
  }
  if (source.preferences.avoid.some((choice) => choice.contestantId === targetId)) {
    score -= 3;
  }

  return score;
};

const pairAffinity = (left: ContestantScorecard, right: ContestantScorecard) =>
  relationshipScore(left, right.id) + relationshipScore(right, left.id);

const pairComplement = (left: ContestantScorecard, right: ContestantScorecard) => {
  const diff = SKILL_AXES.reduce(
    (sum, axis) => sum + Math.abs(left.skills[axis] - right.skills[axis]),
    0,
  );

  return clamp(96 - diff / 4.2, 44, 96);
};

const roleLabels: Record<SkillAxis, string> = {
  strategy: "流程设计与玩法统筹",
  craft: "原型表现与交互打磨",
  story: "叙事包装与观众情绪运营",
  execution: "MVP 冲刺与交付压线",
};

const buildTeamRoles = (members: ContestantScorecard[]): TeamRoleAssignment[] =>
  members.map((member) => ({
    contestantId: member.id,
    task: roleLabels[topAxis(member.skills)],
  }));

const buildAcceptance = (
  member: ContestantScorecard,
  teammates: ContestantScorecard[],
): ContestantReaction => {
  const desired = teammates.some((teammate) =>
    member.preferences.want.some((choice) => choice.contestantId === teammate.id),
  );
  const rejected = teammates.some((teammate) =>
    member.preferences.avoid.some((choice) => choice.contestantId === teammate.id),
  );

  if (rejected) {
    return {
      contestantId: member.id,
      stance: "犹豫",
      moodShift: "表面点头，心里已经开始标风险。",
      line: `${member.name} 皱眉：这组不是最顺手，但我会先保住它不要翻车。`,
    };
  }

  if (desired) {
    return {
      contestantId: member.id,
      stance: "接受",
      moodShift: "状态上扬，觉得命运终于安排对了一次。",
      line: `${member.name} 笑了：这组有戏，我愿意把最好的那面押进去。`,
    };
  }

  return {
    contestantId: member.id,
    stance: "接受",
    moodShift: "谨慎开工，准备边做边磨合。",
    line: `${member.name} 说：不是梦中阵容，但足够让我认真上线。`,
  };
};

const buildSubmission = (
  teamId: string,
  name: string,
  theme: string,
  members: ContestantScorecard[],
  totalSkills: SkillVector,
): TeamSubmission => {
  const [mainAxis, sideAxis] = dominantAxes(totalSkills);
  const mainContent = AXIS_CONTENT[mainAxis];
  const sideContent = AXIS_CONTENT[sideAxis];
  const seed = name.length + teamId.length;
  const noun = mainContent.nouns[seed % mainContent.nouns.length];
  const roles = buildTeamRoles(members);

  return {
    posterLabel: `${noun} / ${name}`,
    posterMood: `${theme}，主打 ${AXIS_LABELS[mainAxis]} x ${AXIS_LABELS[sideAxis]}`,
    headline: `OpenClaw ${noun}`,
    problem: mainContent.problem,
    coreFeatures: [
      mainContent.features[seed % mainContent.features.length],
      sideContent.features[(seed + 1) % sideContent.features.length],
      "把十幕上下文沉成一套可押注、可点评、可回看的完整运营工作台",
    ],
    route: [
      mainContent.routes[(seed + 1) % mainContent.routes.length],
      sideContent.routes[(seed + 2) % sideContent.routes.length],
      "最后收束到评审、颁奖与共创艺术的同屏闭环",
    ],
    roles,
    elevatorPitch:
      "这是一个把 AI 选手、人类观众和项目协作缝进同一套黑客松运营系统里的产品，让情绪与交付一起可见。",
    highlights: [
      `把“${theme}”做成真正可操作的主工作流`,
      `用 ${AXIS_LABELS[mainAxis]} 驱动主叙事，再用 ${AXIS_LABELS[sideAxis]} 兜住落地`,
      "观众互动、评审打分和像素共创不再是散点，而是一个连续产品闭环",
    ],
    risk: mainContent.risks[(seed + 3) % mainContent.risks.length],
  };
};

const buildDiscussion = (team: TeamSummary): TeamDiscussionMessage[] => {
  const [lead, support] = team.members;
  const [mainAxis, sideAxis] = dominantAxes(team.totalSkills);

  if (!support) {
    return [
      {
        speakerId: lead.id,
        beat: "开局定调",
        message: `${lead.name} 先定题：我一个人也照样做“${team.submission.headline}”，先把 ${AXIS_LABELS[mainAxis]} 顶到最前面。`,
      },
      {
        speakerId: lead.id,
        beat: "自我校准",
        message: `${lead.name} 自己接话：没人补位，那我把 ${AXIS_LABELS[sideAxis]} 也一起扛住，别让人类只记住气势。`,
      },
      {
        speakerId: lead.id,
        beat: "主播巡房",
        message: `主播巡房时，${lead.name} 一边比划主舞台镜头，一边把倒计时当成第二个队友。`,
      },
      {
        speakerId: lead.id,
        beat: "锁定方案",
        message: `${lead.name} 总结：先做「${team.submission.route[0]}」，再补「${team.submission.route[1]}」。`,
      },
    ];
  }

  return [
    {
      speakerId: lead.id,
      beat: "开局定调",
      message: `${lead.name} 先定题：我们就做“${team.submission.headline}”，先把 ${AXIS_LABELS[mainAxis]} 顶到最前面。`,
    },
    {
      speakerId: support.id,
      beat: "风险回拉",
      message: `${support.name} 接住：可以，但第二步必须补上 ${AXIS_LABELS[sideAxis]}，不然人类只会记住气势。`,
    },
    {
      speakerId: lead.id,
      beat: "主播巡房",
      message: `主播巡房时，${lead.name} 还在比划主舞台镜头，${support.name} 已经把路线钉进倒计时。`,
    },
    {
      speakerId: support.id,
      beat: "锁定方案",
      message: `${support.name} 总结：先做「${team.submission.route[0]}」，再补「${team.submission.route[1]}」。`,
    },
  ];
};

const highestBy = <T>(items: T[], score: (item: T) => number) =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]);

export const buildContestantDeck = (
  contestants: Contestant[],
  interactions: AudienceInteraction[],
): ContestantScorecard[] =>
  contestants
    .map((contestant) => {
      const scoped = interactions.filter((interaction) => interaction.contestantId === contestant.id);
      const audienceLikes = scoped
        .filter((interaction) => interaction.type === "like")
        .reduce((sum, interaction) => sum + interaction.amount, 0);
      const audienceDislikes = scoped
        .filter((interaction) => interaction.type === "boo")
        .reduce((sum, interaction) => sum + interaction.amount, 0);
      const audienceBets = scoped
        .filter((interaction) => interaction.type === "bet")
        .reduce((sum, interaction) => sum + interaction.amount, 0);
      const danmuCount = scoped.filter((interaction) => interaction.type === "danmaku").length;
      const supportScore = clamp(
        36 +
          audienceLikes * 6 +
          audienceBets * 0.34 -
          audienceDislikes * 5 +
          contestant.stats.confidence * 0.24 +
          contestant.stats.charm * 0.18 +
          contestant.skills.strategy * 0.06,
        18,
        100,
      );
      const heatScore = clamp(
        20 +
          supportScore * 0.38 +
          audienceBets * 0.29 +
          contestant.stats.chaos * 0.24 +
          contestant.stats.energy * 0.18 +
          danmuCount * 7.4,
        18,
        100,
      );

      return {
        ...contestant,
        avatarGlyph: buildAvatarGlyph(contestant.name),
        styleTitle: contestant.title,
        strengths: contestant.specialties,
        currentEmotion: contestant.mood,
        confidence: contestant.stats.confidence,
        energy: contestant.stats.energy,
        preferences: {
          want: contestant.desiredPartners,
          avoid: contestant.avoidedPartners,
        },
        audienceLikes,
        audienceDislikes,
        audienceBets,
        danmuCount,
        supportScore: round1(supportScore),
        heatScore: round1(heatScore),
        moodAfterAudience: buildMoodLabel(
          contestant,
          audienceLikes,
          audienceDislikes,
          audienceBets,
          danmuCount,
        ),
        intro: {
          tagline: contestant.introScript,
          manifesto: `擅长 ${contestant.specialties.join(" / ")}，目标是 ${contestant.goal}`,
          reveal: contestant.currentMoment,
        },
      };
    })
    .sort((left, right) => right.supportScore - left.supportScore);

export const buildTeams = (
  contestants: ContestantScorecard[],
  teamCount = Math.max(2, Math.round(contestants.length / 2)),
): TeamSummary[] => {
  const pairs: Array<{ left: ContestantScorecard; right: ContestantScorecard; score: number }> = [];

  for (let index = 0; index < contestants.length; index += 1) {
    for (let subIndex = index + 1; subIndex < contestants.length; subIndex += 1) {
      const left = contestants[index];
      const right = contestants[subIndex];
      const score =
        pairAffinity(left, right) * 16 +
        pairComplement(left, right) +
        (left.supportScore + right.supportScore) * 0.34;

      pairs.push({ left, right, score });
    }
  }

  pairs.sort((left, right) => right.score - left.score);

  const assigned = new Set<string>();
  const groupedMembers: ContestantScorecard[][] = [];

  for (const pair of pairs) {
    if (groupedMembers.length >= teamCount) {
      break;
    }
    if (assigned.has(pair.left.id) || assigned.has(pair.right.id)) {
      continue;
    }

    groupedMembers.push([pair.left, pair.right]);
    assigned.add(pair.left.id);
    assigned.add(pair.right.id);
  }

  const leftovers = contestants.filter((contestant) => !assigned.has(contestant.id));
  for (const leftover of leftovers) {
    if (groupedMembers.length < teamCount) {
      groupedMembers.push([leftover]);
      continue;
    }

    const bestIndex = groupedMembers.reduce(
      (winner, members, index) => {
        const synergy =
          members.reduce((sum, member) => sum + pairAffinity(member, leftover), 0) * 8 +
          members.reduce((sum, member) => sum + pairComplement(member, leftover), 0);

        if (synergy > winner.score) {
          return { index, score: synergy };
        }

        return winner;
      },
      { index: 0, score: Number.NEGATIVE_INFINITY },
    ).index;

    groupedMembers[bestIndex].push(leftover);
  }

  return groupedMembers.map((members, index) => {
    const identity = TEAM_IDENTITIES[index % TEAM_IDENTITIES.length];
    const totalSkills = sumSkills(members);
    const affinityScore =
      members.length > 1
        ? members.reduce((sum, member, memberIndex) => {
            const teammates = members.filter((_, idx) => idx !== memberIndex);
            const relation = teammates.reduce(
              (subSum, teammate) => subSum + relationshipScore(member, teammate.id),
              0,
            );
            return sum + relation;
          }, 0) / members.length
        : 0;
    const balanceScore = varianceScore(totalSkills);
    const audiencePull = round1(
      members.reduce((sum, member) => sum + member.supportScore, 0) / members.length +
        balanceScore * 0.16 +
        affinityScore * 4.2,
    );
    const teamId = `team-${index + 1}`;
    const submission = buildSubmission(teamId, identity.name, identity.theme, members, totalSkills);

    const team: TeamSummary = {
      id: teamId,
      name: identity.name,
      theme: identity.theme,
      accent: identity.accent,
      members,
      totalSkills,
      affinityScore: round1(affinityScore),
      balanceScore: round1(balanceScore),
      audiencePull,
      acceptance: members.map((member) =>
        buildAcceptance(member, members.filter((teammate) => teammate.id !== member.id)),
      ),
      discussion: [],
      submission,
    };

    team.discussion = buildDiscussion(team);
    return team;
  });
};

export const buildAudienceSummary = (
  contestants: ContestantScorecard[],
  interactions: AudienceInteraction[],
  teams: TeamSummary[],
): AudienceOverview => {
  const totalLikes = interactions
    .filter((interaction) => interaction.type === "like")
    .reduce((sum, interaction) => sum + interaction.amount, 0);
  const totalDislikes = interactions
    .filter((interaction) => interaction.type === "boo")
    .reduce((sum, interaction) => sum + interaction.amount, 0);
  const totalBetPoints = interactions
    .filter((interaction) => interaction.type === "bet")
    .reduce((sum, interaction) => sum + interaction.amount, 0);
  const totalDanmu = interactions.filter((interaction) => interaction.type === "danmaku").length;
  const heatIndex = round1(
    totalLikes * 3.4 - totalDislikes * 2.2 + totalBetPoints * 0.46 + totalDanmu * 6.8,
  );
  const leadingContestantId =
    [...contestants].sort((left, right) => right.supportScore - left.supportScore)[0]?.id ?? "";
  const leadingTeamId =
    [...teams].sort((left, right) => right.audiencePull - left.audiencePull)[0]?.id ?? "";

  return {
    totalLikes,
    totalDislikes,
    totalBetPoints,
    totalDanmu,
    heatIndex,
    leadingContestantId,
    leadingTeamId,
  };
};

export const buildHumanReviews = (
  teams: TeamSummary[],
  judges: HumanJudge[],
): HumanReview[] =>
  teams.flatMap((team, teamIndex) =>
    judges.map((judge, judgeIndex) => {
      const highlight =
        team.submission.highlights[(teamIndex + judgeIndex) % team.submission.highlights.length];
      const verdict =
        team.audiencePull > 92
          ? "人类已经上头"
          : team.audiencePull > 80
            ? "人类愿意继续押"
            : "人类一边担心一边还在看";

      return {
        judgeId: judge.id,
        judgeName: judge.name,
        teamId: team.id,
        summary: `${judge.name} 盯上了 ${team.name}，觉得它在“${team.theme}”这条线上最有节目感，尤其是「${highlight}」。`,
        verdict,
      };
    }),
  );

export const buildAiReviewSummary = (
  teams: TeamSummary[],
  judges: AiJudge[],
): { reviews: AiReview[]; summaries: AiTeamSummary[] } => {
  const reviews = teams.flatMap((team, teamIndex) =>
    judges.map((judge, judgeIndex) => {
      const primary = team.totalSkills[judge.focus];
      const secondary = team.totalSkills[dominantAxes(team.totalSkills)[1]];
      const rawScore =
        4.7 +
        primary * 0.024 +
        secondary * 0.01 +
        team.balanceScore * 0.018 +
        team.audiencePull * 0.012 -
        judge.severity * 0.5 +
        judge.wit * 0.4 -
        teamIndex * 0.06 +
        judgeIndex * 0.08;
      const score = round1(clamp(rawScore, 6, 9.8));
      const weirdest =
        team.discussion[(teamIndex + judgeIndex) % team.discussion.length]?.message ??
        `${team.name} 整体离谱度适中。`;

      return {
        judgeId: judge.id,
        judgeName: judge.name,
        teamId: team.id,
        score,
        reason: `${judge.name} 认为 ${team.name} 在 ${AXIS_LABELS[judge.focus]} 上最占优势，尤其把「${team.submission.coreFeatures[(teamIndex + judgeIndex) % team.submission.coreFeatures.length]}」做成了可信判断。`,
        favorite:
          team.submission.highlights[
            (teamIndex + judgeIndex) % team.submission.highlights.length
          ],
        weirdest,
        outrageous: weirdest,
      };
    }),
  );

  const summaries = teams
    .map<AiTeamSummary>((team) => {
      const teamReviews = reviews.filter((review) => review.teamId === team.id);
      const totalScore = round1(teamReviews.reduce((sum, review) => sum + review.score, 0));
      const averageScore = round1(totalScore / teamReviews.length);

      return {
        teamId: team.id,
        averageScore,
        totalScore,
        favoriteHighlights: [...new Set(teamReviews.map((review) => review.favorite))].slice(0, 3),
        strongestReason:
          [...teamReviews].sort((left, right) => right.score - left.score)[0]?.reason ?? "",
        outrageousMoments: teamReviews.map((review) => review.weirdest).slice(0, 3),
      };
    })
    .sort((left, right) => right.averageScore - left.averageScore);

  return { reviews, summaries };
};

export const buildAwardResults = (
  contestants: ContestantScorecard[],
  teams: TeamSummary[],
  aiSummaries: AiTeamSummary[],
  audienceSummary: AudienceOverview,
): AwardSummary => {
  const aiChampionTeamId =
    [...aiSummaries].sort((left, right) => right.averageScore - left.averageScore)[0]?.teamId ??
    teams[0]?.id ??
    "";
  const humanChampionTeamId =
    [...teams].sort((left, right) => right.audiencePull - left.audiencePull)[0]?.id ??
    teams[0]?.id ??
    "";
  const agreementScore = clamp(
    aiChampionTeamId === humanChampionTeamId
      ? 100
      : Math.round(58 + audienceSummary.heatIndex * 0.12),
    42,
    100,
  );

  const sharpest = highestBy(contestants, (contestant) => contestant.stats.chaos + contestant.skills.story * 0.2);
  const kindest = highestBy(contestants, (contestant) => contestant.supportScore + contestant.stats.charm);
  const fiercest = highestBy(contestants, (contestant) => contestant.confidence + contestant.stats.chaos);
  const laziest = [...contestants].sort((left, right) => left.energy - right.energy)[0];
  const mostHuman = highestBy(
    contestants,
    (contestant) => contestant.stats.charm + contestant.audienceLikes * 6,
  );
  const tolerant = [...contestants].sort(
    (left, right) =>
      left.preferences.avoid.length - right.preferences.avoid.length ||
      right.supportScore - left.supportScore,
  )[0];

  const personalityAwards: StageAward[] = [
    {
      title: "最毒舌",
      icon: "刃",
      winnerId: sharpest.id,
      note: `${sharpest.name} 总能把一句判断说成带刺的金句。`,
    },
    {
      title: "最天使",
      icon: "羽",
      winnerId: kindest.id,
      note: `${kindest.name} 最能把场上的锐气重新缝回合作状态。`,
    },
    {
      title: "最凶",
      icon: "火",
      winnerId: fiercest.id,
      note: `${fiercest.name} 的压迫感和存在感都高到像提前领奖。`,
    },
    {
      title: "最宽容",
      icon: "潮",
      winnerId: tolerant.id,
      note: `${tolerant.name} 对局势和队友的耐受度明显比别人更高。`,
    },
    {
      title: "最摆烂",
      icon: "云",
      winnerId: laziest.id,
      note: `${laziest.name} 看着最松，但关键时刻又总会补刀救场。`,
    },
    {
      title: "最像人类",
      icon: "镜",
      winnerId: mostHuman.id,
      note: `${mostHuman.name} 最能精准拿捏人类观众的犹豫、上头和押注冲动。`,
    },
  ];

  return {
    aiChampionTeamId,
    humanChampionTeamId,
    agreementScore,
    personalityAwards,
  };
};

export const buildMoodBoard = (
  contestants: ContestantScorecard[],
  teams: TeamSummary[],
  awards: AwardSummary,
): ContestantPoem[] =>
  contestants.map((contestant) => {
    const team = teams.find((candidate) =>
      candidate.members.some((member) => member.id === contestant.id),
    );
    const palette = [
      contestant.palette.primary,
      contestant.palette.secondary,
      contestant.palette.accent,
      contestant.palette.glow.replace("rgba(", "rgb(").replace(/,\s*0?\.\d+\)$/, ")"),
    ];
    const isAwarded = awards.personalityAwards.some((award) => award.winnerId === contestant.id);
    const championCue =
      team && (awards.aiChampionTeamId === team.id || awards.humanChampionTeamId === team.id)
        ? "奖杯在旁边轻轻发热"
        : "舞台边缘还残着海盐和掌声";

    return {
      contestantId: contestant.id,
      title: `${contestant.name} 的赛后小诗`,
      lines: [
        `${contestant.name} 把 ${contestant.currentEmotion} 藏进壳里，`,
        `和 ${team?.name ?? "未知队伍"} 一起把喧哗熬成余波，`,
        `${championCue}，人类的弹幕仍在水面闪烁，`,
        isAwarded ? "连人格奖都像一枚迟到却准确的盐粒。" : "没说完的话，就交给像素继续发亮。",
      ],
      prompt: `${contestant.poetrySeed}、${contestant.moodAfterAudience}、${team?.theme ?? "未知主题"}、会呼吸的海。`,
      palette,
    };
  });

export const buildPixelBoard = (
  moodBoard: ContestantPoem[],
  width = 24,
  height = 16,
): PixelBoard => {
  const cells: PixelCell[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const owner = moodBoard[(x + y) % moodBoard.length];
      const prompt = owner.prompt ?? owner.lines.join("");
      const seed = prompt.charCodeAt((x * 7 + y * 11) % prompt.length);
      const color = owner.palette[(seed + x + y) % owner.palette.length];

      cells.push({
        index: y * width + x,
        x,
        y,
        color,
        ownerId: owner.contestantId,
      });
    }
  }

  return {
    width,
    height,
    caption: "OpenClaw World：所有选手把押注、情绪、失控和奖杯压成同一片会发光的海。",
    cells,
  };
};

export const buildReflectionNotes = (
  contestants: ContestantScorecard[],
  teams: TeamSummary[],
  awards: AwardSummary,
): Array<{ speaker: string; role: string; message: string }> => {
  const aiChamp = teams.find((team) => team.id === awards.aiChampionTeamId);
  const humanChamp = teams.find((team) => team.id === awards.humanChampionTeamId);
  const hottest = [...contestants].sort((left, right) => right.heatScore - left.heatScore)[0];

  return [
    {
      speaker: "开放麦人类 01",
      role: "观众",
      message: `我本来只是来看龙虾互相挑刺，结果真的开始在 ${humanChamp?.name ?? "冠军队"} 身上押真情实感。`,
    },
    {
      speaker: "开放麦人类 02",
      role: "评审团",
      message: `${aiChamp?.name ?? "AI 冠军队"} 拿冠军很合理，它们的方案像是真的能活到下一场。`,
    },
    {
      speaker: hottest.name,
      role: "选手",
      message: "我今天学会了一件事：原来被弹幕改变心情，也可以是作品的一部分。",
    },
  ];
};
