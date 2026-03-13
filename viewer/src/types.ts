export type MemoryEvent = {
  round: number;
  type: string;
  by: string;
  target?: string;
  note?: string;
};

export type ReplayCanvasUpdate = {
  x: number;
  y: number;
  owner: string | null;
  color: string;
};

export type ReplayAction =
  | { action: "wait" }
  | { action: "paint"; x: number; y: number; color: string }
  | { action: "fortify"; x: number; y: number }
  | { action: "invade"; x: number; y: number }
  | { action: "burst"; center_x: number; center_y: number; radius: 1 };

export type ReplayActionStep = {
  step_index: number;
  kind: "seed" | "action" | "resolve_fill" | "resolve_harmonize";
  actor_id: string;
  label: string;
  updates: ReplayCanvasUpdate[];
  action?: ReplayAction;
};

export type ReplayRound = {
  round: number;
  art_phase: {
    id: "block_in" | "silhouette" | "motif" | "background" | "resolve";
    label: string;
    focus: string;
  };
  canvas_updates: ReplayCanvasUpdate[];
  action_steps?: ReplayActionStep[];
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
  social_metrics: {
    alliance_links: number;
    rivalry_links: number;
    max_tension: number;
    avg_trust: number;
    avg_debt: number;
  };
  social_snapshot: Array<{
    agent_id: string;
    name: string;
    color: string;
    archetype: string;
    last_round_summary?: string;
    emotion: {
      anger: number;
      fear: number;
      confidence: number;
      satisfaction: number;
    };
    strongest_bonds: SocialRelation[];
    hottest_rivalries: SocialRelation[];
  }>;
  highlights: MemoryEvent[];
  errors: Array<{ round: number; agent_id: string; type: string; detail: string }>;
};

export type SocialRelation = {
  target_id: string;
  target_name: string;
  trust: number;
  affinity: number;
  debt: number;
  tension: number;
  recent_shared_events: string[];
};

export type ArtDirection = {
  mode: string;
  theme_prompt: string;
  title: string;
  mood_words: string[];
  palette: string[];
  forbidden_colors: string[];
  motifs: string[];
  composition_notes: string[];
};

export type ReplayData = {
  schema_version?: string;
  config: {
    width: number;
    height: number;
    rounds: number;
    agent_count: number;
    max_concurrent_agents: number;
    dry_run: boolean;
    model: string;
    profile_path?: string;
    myth_prompt?: string;
  };
  art_direction: ArtDirection;
  ranking: Array<{
    agent_id: string;
    name: string;
    territory_cells: number;
    final_score: number;
  }>;
  final_highlights: MemoryEvent[];
  replay: ReplayRound[];
};

export type ReplayListItem = {
  name: string;
  mtime: string;
  bytes: number;
  mode?: "dry-run" | "live";
  agent_count?: number;
};

export type Frame = {
  round: number;
  board: Array<Array<{ owner: string | null; color: string }>>;
  territory: Map<string, number>;
  source: ReplayRound;
};

export type AgentDirectoryItem = {
  id: string;
  name: string;
  archetype?: string;
  color?: string | null;
};

export type HydratedReplay = ReplayData & {
  colorMap: Map<string, string>;
  agentDirectory: AgentDirectoryItem[];
};
