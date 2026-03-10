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

export interface LiveContestant extends Contestant {
  liveStats: ContestantStats;
  audience: {
    likes: number;
    boos: number;
    betPool: number;
    danmakuCount: number;
    sentiment: number;
    heat: number;
  };
}

export interface AudienceLeaderboardEntry {
  contestantId: string;
  score: number;
  label: string;
}

export interface AudienceSummary {
  totals: {
    likes: number;
    boos: number;
    betPool: number;
    danmakuCount: number;
  };
  trendingMessages: AudienceEvent[];
  leaderId: string;
  underdogId: string;
  leaderboard: AudienceLeaderboardEntry[];
}

export interface PreferenceSummary {
  adoredId: string;
  dreadedId: string;
  affectionCounts: Record<string, number>;
  frictionCounts: Record<string, number>;
}

export interface TeamAcceptance {
  contestantId: string;
  verdict: string;
  mood: string;
}

export interface RoomMessage {
  speakerId: string;
  content: string;
  tone: string;
}

export interface TeamDiscussion {
  projectName: string;
  problem: string;
  coreFeatures: string[];
  route: string[];
  division: string[];
  roomMessages: RoomMessage[];
  patrolNote: string;
}

export interface Submission {
  posterTitle: string;
  posterStamp: string;
  elevatorPitch: string;
  highlights: string[];
  risk: string;
  fileHint: string;
}

export interface TeamProfile {
  id: string;
  name: string;
  theme: string;
  memberIds: string[];
  compatibility: number;
  skillBars: SkillMatrix;
  acceptance: TeamAcceptance[];
  discussion: TeamDiscussion;
  submission: Submission;
  humanBetShare: number;
}

export interface HumanCommentary {
  judgeId: string;
  teamId: string;
  quote: string;
  stance: string;
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

export interface TeamScore {
  teamId: string;
  average: number;
  humanBuzz: number;
  aiLead: boolean;
  audienceLead: boolean;
}

export interface PersonalityAward {
  title: string;
  contestantId: string;
  citation: string;
}

export interface AwardResults {
  aiChampionTeamId: string;
  audienceChampionTeamId: string;
  predictionAgreement: number;
  personalityAwards: PersonalityAward[];
  humanChampionTeamId?: string;
  agreementScore?: number;
}

export interface ContestantPoem {
  contestantId: string;
  title?: string;
  lines: string[];
  prompt?: string;
  palette: string[];
}

export interface PixelCell {
  index: number;
  x?: number;
  y?: number;
  color: string;
  ownerId: string;
}

export interface OpenMicEntry {
  speaker: string;
  role: string;
  content: string;
}

export interface ShowSnapshot {
  liveContestants: LiveContestant[];
  audienceSummary: AudienceSummary;
  preferenceSummary: PreferenceSummary;
  teams: TeamProfile[];
  humanCommentary: HumanCommentary[];
  aiReviews: AiReview[];
  scoreBoard: TeamScore[];
  awards: AwardResults;
  poems: ContestantPoem[];
  pixelBoard: PixelCell[];
  openMic: OpenMicEntry[];
}

export type StageId = ActDefinition["id"];

export type InteractionType = AudienceEventType;

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

export interface StageAward {
  title: string;
  icon: string;
  winnerId: string;
  note: string;
}

export interface AwardSummary {
  aiChampionTeamId: string;
  humanChampionTeamId: string;
  agreementScore: number;
  personalityAwards: StageAward[];
}

export interface PixelBoard {
  width: number;
  height: number;
  caption: string;
  cells: PixelCell[];
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
