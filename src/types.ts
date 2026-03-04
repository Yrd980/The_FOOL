export type Persona = "expansionist" | "defender" | "artist" | "schemer";

export interface GoalWeights {
  territory: number;
  art: number;
  revenge: number;
  reputation: number;
}

export interface Emotion {
  anger: number;
  fear: number;
  confidence: number;
  satisfaction: number;
}

export interface IdentityDNA {
  archetype: string;
  core_values: string[];
  speech_style: string;
  risk_appetite: number;
  aggression_bias: number;
  diplomacy_bias: number;
  creativity_bias: number;
  signature_moves: string[];
  taboos: string[];
}

export interface Relation {
  target_id: string;
  trust: number;
  affinity: number;
  debt: number;
}

export type MemoryEventType =
  | "attacked"
  | "betrayed"
  | "allied"
  | "expanded"
  | "lost_area"
  | "won_conflict"
  | "signed_treaty"
  | "broke_treaty";

export interface MemoryEvent {
  round: number;
  type: MemoryEventType;
  by: string;
  target?: string;
  note?: string;
}

export interface AgentState {
  id: string;
  name: string;
  persona: Persona;
  color: string;
  identity_dna: IdentityDNA;
  goal_weights: GoalWeights;
  emotion: Emotion;
  reputation: number;
  energy: number;
  cooldowns: {
    burst: number;
  };
  relations: Relation[];
  memory: MemoryEvent[];
  last_round_summary?: string;
}

export interface DigitalTwinProfile {
  id?: string;
  name: string;
  color?: string;
  persona?: Persona;
  identity_dna: IdentityDNA;
  goal_weights?: Partial<GoalWeights>;
}

export interface Treaty {
  a: string;
  b: string;
  type: "no_attack";
  expires_round: number;
}

export interface TreatyProposal {
  proposal_id: string;
  target_id: string;
  type: "no_attack" | "joint_attack";
  duration_rounds: number;
  target_enemy_id?: string;
}

export interface PrivateMessage {
  target_id: string;
  content: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ActionHints {
  paint_candidates: Point[];
  fortify_candidates: Point[];
  invade_candidates: Point[];
  burst_centers: Point[];
  contested_hotspots: Point[];
}

export type TurnIntent = "expand" | "defend" | "cooperate" | "betray" | "art_focus" | "revenge";

export interface WaitAction {
  action: "wait";
}

export interface PaintAction {
  action: "paint";
  x: number;
  y: number;
  color: string;
}

export interface FortifyAction {
  action: "fortify";
  x: number;
  y: number;
}

export interface InvadeAction {
  action: "invade";
  x: number;
  y: number;
}

export interface BurstAction {
  action: "burst";
  center_x: number;
  center_y: number;
  radius: 1;
}

export type TurnAction = WaitAction | PaintAction | FortifyAction | InvadeAction | BurstAction;

export interface TurnDecision {
  agent_id: string;
  round: number;
  intent: TurnIntent;
  public_message: string;
  private_messages: PrivateMessage[];
  treaty_proposals: TreatyProposal[];
  actions: TurnAction[];
  emotion_delta: {
    anger: number;
    fear: number;
    confidence: number;
    satisfaction: number;
  };
  mood_change_reason: string;
}

export interface EngineConfig {
  width: number;
  height: number;
  rounds: number;
  agentCount: number;
  maxConcurrentAgents: number;
  dryRun: boolean;
  model: string;
  profilePath?: string;
}

export interface ScoreItem {
  agent_id: string;
  name: string;
  territory_cells: number;
  territory_score: number;
  art_score: number;
  reputation: number;
  final_score: number;
}

export interface ReplayRound {
  round: number;
  public_messages: Array<{ agent_id: string; message: string }>;
  private_messages: Array<{ from: string; to: string; content: string }>;
  persona_notes: Array<{ agent_id: string; note: string; proactive_score: number }>;
  round_metrics: {
    expanded: number;
    attacked: number;
    treaties_signed: number;
    public_messages: number;
    private_messages: number;
  };
  highlights: MemoryEvent[];
  errors: Array<{ round: number; agent_id: string; type: string; detail: string }>;
}

export interface SimulationResult {
  config: {
    width: number;
    height: number;
    rounds: number;
    agent_count: number;
    max_concurrent_agents: number;
    dry_run: boolean;
    model: string;
    profile_path?: string;
  };
  ranking: ScoreItem[];
  final_highlights: MemoryEvent[];
  replay: ReplayRound[];
}
