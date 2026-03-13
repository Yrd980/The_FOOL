export interface ContestantStats {
  confidence: number;
  energy: number;
  charm: number;
  chaos: number;
}

export interface SkillMatrix {
  strategy: number;
  craft: number;
  story: number;
  execution: number;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

export interface PreferenceTarget {
  contestantId: string;
  reason: string;
}

export interface Contestant {
  id: string;
  name: string;
  title: string;
  archetype: string;
  persona: string;
  background: string;
  specialties: string[];
  dislikes: string[];
  goal: string;
  mood: string;
  introScript: string;
  currentMoment: string;
  stats: ContestantStats;
  skills: SkillMatrix;
  palette: ColorPalette;
  desiredPartners: PreferenceTarget[];
  avoidedPartners: PreferenceTarget[];
  danmakuHook: string;
  poetrySeed: string;
  humanProxy: string;
}

export interface ActDefinition {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  objective: string;
  deliverables: string[];
  hostCue: string;
  emphasis: string;
}

export type AudienceEventType = "like" | "boo" | "bet" | "danmaku";

export interface AudienceEvent {
  id: string;
  contestantId: string;
  type: AudienceEventType;
  source: string;
  content: string;
  amount: number;
  timestampLabel: string;
}

export interface HumanJudge {
  id: string;
  name: string;
  role: string;
  style: string;
  catchphrase: string;
}

export interface AiJudge {
  id: string;
  name: string;
  title: string;
  persona: string;
  focus: keyof SkillMatrix;
  severity: number;
  wit: number;
  signature: string;
}

export interface AiReview {
  judgeId: string;
  teamId: string;
  score: number;
  judgeName?: string;
  reason: string;
  favorite: string;
  weirdest: string;
  outrageous?: string;
}

export type StageId = ActDefinition["id"];

export type SkillAxis = keyof SkillMatrix;

export type SkillVector = SkillMatrix;

export type AudienceInteraction = AudienceEvent;

export interface IntroDetails {
  tagline: string;
  manifesto: string;
  reveal: string;
}

export interface ContestantPreferences {
  want: PreferenceTarget[];
  avoid: PreferenceTarget[];
}

export interface ContestantScorecard extends Contestant {
  avatarGlyph: string;
  styleTitle: string;
  strengths: string[];
  currentEmotion: string;
  confidence: number;
  energy: number;
  preferences: ContestantPreferences;
  audienceLikes: number;
  audienceDislikes: number;
  audienceBets: number;
  danmuCount: number;
  supportScore: number;
  heatScore: number;
  moodAfterAudience: string;
  intro: IntroDetails;
}

export interface ContestantReaction {
  contestantId: string;
  stance: "接受" | "犹豫";
  moodShift: string;
  line: string;
}

export interface TeamDiscussionMessage {
  speakerId: string;
  beat: string;
  message: string;
}

export interface TeamRoleAssignment {
  contestantId: string;
  task: string;
}

export interface TeamSubmission {
  posterLabel: string;
  posterMood: string;
  headline: string;
  problem: string;
  coreFeatures: string[];
  route: string[];
  roles: TeamRoleAssignment[];
  elevatorPitch: string;
  highlights: string[];
  risk: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  theme: string;
  accent: string;
  members: ContestantScorecard[];
  totalSkills: SkillVector;
  affinityScore: number;
  balanceScore: number;
  audiencePull: number;
  acceptance: ContestantReaction[];
  discussion: TeamDiscussionMessage[];
  submission: TeamSubmission;
}

export interface HumanReview {
  judgeId: string;
  judgeName: string;
  teamId: string;
  summary: string;
  verdict: string;
}

export interface AiTeamSummary {
  teamId: string;
  averageScore: number;
  totalScore: number;
  favoriteHighlights: string[];
  strongestReason: string;
  outrageousMoments: string[];
}

export interface AudienceOverview {
  totalLikes: number;
  totalDislikes: number;
  totalBetPoints: number;
  totalDanmu: number;
  heatIndex: number;
  leadingContestantId: string;
  leadingTeamId: string;
}

export type OpenClawContestantState =
  | "speaking"
  | "listening"
  | "muted"
  | "queued"
  | "raised-hand";

export interface ContestantOpenClawPresence {
  contestantId: string;
  seatLabel: string;
  connectionLabel: string;
  roomX: number;
  roomY: number;
}

export interface OpenClawConversation {
  id: string;
  title: string;
  subtitle: string;
  nearbyHint: string;
  roomLabel: string;
  hostLabel: string;
}
