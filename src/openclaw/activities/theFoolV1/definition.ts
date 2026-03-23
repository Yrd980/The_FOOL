import type {
  SkillBinding,
  StageTemplate,
  SubmissionSchema,
  WorldProjection,
} from "../../platform/contracts";
import {
  THE_FOOL_ACTIVITY_DOC_VERSION,
  THE_FOOL_REQUIRED_TEAM_IDS,
  THE_FOOL_REQUIREMENTS_DOC_ID,
  THE_FOOL_SKILL_DOC_VERSION,
} from "./constants";

export const theFoolStageTemplates: StageTemplate[] = [
  {
    id: "act-1-intro",
    name: "自我介绍",
    durationSec: 300,
    allowedActions: ["talk", "reaction", "bet", "vote", "query"],
    transitionRules: [
      { id: "act-1-manual", sourceStageId: "act-1-intro", targetStageId: "act-2-preference", type: "manual", config: {} },
    ],
  },
  {
    id: "act-2-preference",
    name: "组队偏好",
    durationSec: 240,
    allowedActions: ["talk", "query"],
    transitionRules: [
      { id: "act-2-manual", sourceStageId: "act-2-preference", targetStageId: "act-3-assignment", type: "manual", config: {} },
    ],
  },
  {
    id: "act-3-assignment",
    name: "组织龙虾分组",
    durationSec: 180,
    allowedActions: ["broadcast", "talk", "query"],
    transitionRules: [
      { id: "act-3-manual", sourceStageId: "act-3-assignment", targetStageId: "act-4-discussion", type: "manual", config: {} },
    ],
  },
  {
    id: "act-4-discussion",
    name: "队内讨论",
    durationSec: 900,
    allowedActions: ["move", "talk", "broadcast", "query"],
    transitionRules: [
      { id: "act-4-timer", sourceStageId: "act-4-discussion", targetStageId: "act-5-submission", type: "timer_expired", config: {} },
    ],
  },
  {
    id: "act-5-submission",
    name: "项目提交",
    durationSec: 420,
    allowedActions: [
      "submit",
      "update_submission",
      "open_submission",
      "lock_submission",
      "query",
    ],
    submissionSchemaIds: ["team-project-v1"],
    transitionRules: [
      {
        id: "act-5-submissions-locked",
        sourceStageId: "act-5-submission",
        targetStageId: "act-6-human-review",
        type: "all_required_submissions_locked",
        config: {
          requiredTeamIds: [...THE_FOOL_REQUIRED_TEAM_IDS],
        },
      },
      { id: "act-5-manual", sourceStageId: "act-5-submission", targetStageId: "act-6-human-review", type: "manual", config: {} },
    ],
  },
  {
    id: "act-6-human-review",
    name: "人类观赛点评",
    durationSec: 480,
    allowedActions: ["broadcast", "talk", "reaction", "bet", "vote"],
    transitionRules: [
      { id: "act-6-manual", sourceStageId: "act-6-human-review", targetStageId: "act-7-ai-judging", type: "manual", config: {} },
    ],
  },
  {
    id: "act-7-ai-judging",
    name: "AI 评委评审",
    durationSec: 300,
    allowedActions: ["score", "submit_score", "talk", "query"],
    transitionRules: [
      {
        id: "act-7-scores-completed",
        sourceStageId: "act-7-ai-judging",
        targetStageId: "act-8-awards",
        type: "scores_completed",
        config: {
          expectedJudgeCount: 3,
          submissionSchemaIds: ["team-project-v1"],
        },
      },
      { id: "act-7-manual", sourceStageId: "act-7-ai-judging", targetStageId: "act-8-awards", type: "manual", config: {} },
    ],
  },
  {
    id: "act-8-awards",
    name: "颁奖",
    durationSec: 240,
    allowedActions: ["broadcast", "grant_award", "vote", "query"],
    transitionRules: [
      { id: "act-8-manual", sourceStageId: "act-8-awards", targetStageId: "act-9-co-creation", type: "manual", config: {} },
    ],
  },
  {
    id: "act-9-co-creation",
    name: "全体共创艺术品",
    durationSec: 600,
    allowedActions: ["move", "submit", "open_submission", "draw", "talk", "query"],
    submissionSchemaIds: ["personal-poem-v1"],
    transitionRules: [
      { id: "act-9-manual", sourceStageId: "act-9-co-creation", targetStageId: "act-10-open-mic", type: "manual", config: {} },
    ],
  },
  {
    id: "act-10-open-mic",
    name: "人类观众感想点评",
    durationSec: 300,
    allowedActions: ["talk", "broadcast"],
    transitionRules: [],
  },
];

export const theFoolSubmissionSchemas: SubmissionSchema[] = [
  {
    id: "team-project-v1",
    fields: [
      { key: "posterOrDeck", type: "file", required: true },
      { key: "elevatorPitch", type: "text", required: true },
      { key: "highlights", type: "json", required: true },
      { key: "risk", type: "text", required: true },
    ],
  },
  {
    id: "personal-poem-v1",
    fields: [
      { key: "poem", type: "text", required: true },
      { key: "moodAtSubmission", type: "text", required: false },
    ],
  },
];

export const theFoolWorld: WorldProjection = {
  rooms: [
    { id: "main-stage", label: "Main Stage" },
    { id: "team-room-1", label: "Team Room 1" },
    { id: "team-room-2", label: "Team Room 2" },
    { id: "team-room-3", label: "Team Room 3" },
    { id: "quiet-orbit", label: "Quiet Orbit" },
  ],
  teams: [
    {
      id: "team-1",
      memberIds: ["contestant-01", "contestant-02"],
      roomId: "team-room-1",
    },
    {
      id: "team-2",
      memberIds: ["contestant-03", "contestant-04"],
      roomId: "team-room-2",
    },
    {
      id: "team-3",
      memberIds: ["contestant-05", "contestant-06"],
      roomId: "team-room-3",
    },
  ],
  entities: [
    { id: "contestant-01", kind: "agent", roomId: "main-stage" },
    { id: "contestant-02", kind: "agent", roomId: "main-stage" },
    { id: "contestant-03", kind: "agent", roomId: "main-stage" },
    { id: "contestant-04", kind: "agent", roomId: "main-stage" },
    { id: "contestant-05", kind: "agent", roomId: "main-stage" },
    { id: "contestant-06", kind: "agent", roomId: "main-stage" },
    { id: "host-01", kind: "host", roomId: "main-stage" },
    { id: "judge-01", kind: "judge", roomId: "main-stage" },
    { id: "judge-02", kind: "judge", roomId: "main-stage" },
    { id: "judge-03", kind: "judge", roomId: "main-stage" },
    { id: "viewer-01", kind: "viewer", roomId: "main-stage" },
    { id: "viewer-02", kind: "viewer", roomId: "main-stage" },
    { id: "viewer-03", kind: "viewer", roomId: "main-stage" },
  ],
};

export const theFoolSkillBindings: SkillBinding[] = [
  {
    role: "agent",
    docId: "skill.md",
    version: THE_FOOL_SKILL_DOC_VERSION,
  },
  {
    role: "agent",
    docId: "heartbeat.md",
    version: THE_FOOL_SKILL_DOC_VERSION,
  },
  ...theFoolStageTemplates.map((stageTemplate) => ({
    role: "agent",
    stageId: stageTemplate.id,
    docId: `${THE_FOOL_REQUIREMENTS_DOC_ID}#${stageTemplate.id}`,
    version: THE_FOOL_ACTIVITY_DOC_VERSION,
  })),
  ...theFoolStageTemplates.map((stageTemplate) => ({
    role: "host",
    stageId: stageTemplate.id,
    docId: `${THE_FOOL_REQUIREMENTS_DOC_ID}#${stageTemplate.id}`,
    version: THE_FOOL_ACTIVITY_DOC_VERSION,
  })),
  {
    role: "judge",
    stageId: "act-7-ai-judging",
    docId: `${THE_FOOL_REQUIREMENTS_DOC_ID}#act-7-ai-judging`,
    version: THE_FOOL_ACTIVITY_DOC_VERSION,
  },
];
