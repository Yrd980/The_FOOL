import type { ReplayRound, ReplayActionStep, ReplayData, AgentDirectoryItem, Frame } from "./types";

export const REPLAY_POLL_MS = 7000;
export const DEFAULT_SPEED = 900;
export const MAX_REVEAL_STEPS = 18;
export const MIN_REVEAL_TICK_MS = 45;
export const palette = [
  "#E63946",
  "#2A9D8F",
  "#F4A261",
  "#457B9D",
  "#E9C46A",
  "#1D3557",
  "#FF6B6B",
  "#4CC9F0",
  "#8D99AE",
  "#8338EC",
  "#FF9F1C",
  "#2EC4B6",
  "#E76F51",
  "#3A86FF",
  "#7A9E7E",
  "#F94144",
  "#43AA8B",
  "#577590",
  "#90BE6D",
  "#F3722C"
];

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function parseCoord(target: string | undefined): { x: number; y: number } | null {
  if (!target) return null;
  const match = target.match(/^(\d+),(\d+)$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

export function revealChunkSize(totalUpdates: number): number {
  if (totalUpdates <= 0) return 0;
  return Math.max(1, Math.ceil(totalUpdates / MAX_REVEAL_STEPS));
}

export function actionStepsForRound(round: ReplayRound | null | undefined): ReplayActionStep[] {
  if (!round) return [];
  if (round.action_steps?.length) return round.action_steps;
  if (round.canvas_updates.length === 0) return [];
  return [
    {
      step_index: 0,
      kind: "resolve_fill",
      actor_id: "system",
      label: "Legacy Round Merge",
      updates: round.canvas_updates
    }
  ];
}

export function stableColorMap(replay: ReplayData): Map<string, string> {
  const ids = new Set<string>();
  for (const row of replay.ranking) ids.add(row.agent_id);
  for (const round of replay.replay) {
    for (const message of round.public_messages) ids.add(message.agent_id);
    for (const note of round.persona_notes) ids.add(note.agent_id);
    for (const social of round.social_snapshot) ids.add(social.agent_id);
    for (const event of round.highlights) if (event.by) ids.add(event.by);
  }
  const ordered = [...ids].sort((left, right) => left.localeCompare(right));
  return new Map(ordered.map((id, index) => [id, palette[index % palette.length]]));
}

export function buildAgentDirectory(replay: ReplayData): AgentDirectoryItem[] {
  const directory = new Map<string, AgentDirectoryItem>();
  for (const row of replay.ranking) {
    directory.set(row.agent_id, { id: row.agent_id, name: row.name });
  }
  for (const round of replay.replay) {
    for (const social of round.social_snapshot) {
      directory.set(social.agent_id, {
        id: social.agent_id,
        name: social.name,
        archetype: social.archetype,
        color: social.color
      });
    }
  }
  return [...directory.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function buildFrames(replay: ReplayData): Frame[] {
  const fallbackColors = stableColorMap(replay);
  const board = Array.from({ length: replay.config.height }, () =>
    Array.from({ length: replay.config.width }, () => ({ owner: null as string | null, color: "#111111" }))
  );
  const frames: Frame[] = [];

  for (const round of replay.replay) {
    if (round.canvas_updates?.length) {
      for (const update of round.canvas_updates) {
        if (update.x < 0 || update.y < 0 || update.x >= replay.config.width || update.y >= replay.config.height) continue;
        board[update.y][update.x] = {
          owner: update.owner,
          color: update.color
        };
      }
    } else {
      for (const event of round.highlights) {
        if (event.type !== "expanded" && event.type !== "attacked") continue;
        const point = parseCoord(event.target);
        if (!point) continue;
        if (point.x < 0 || point.y < 0 || point.x >= replay.config.width || point.y >= replay.config.height) continue;
        board[point.y][point.x] = {
          owner: event.by,
          color: fallbackColors.get(event.by) || "#999999"
        };
      }
    }

    const territory = new Map<string, number>();
    for (let y = 0; y < replay.config.height; y += 1) {
      for (let x = 0; x < replay.config.width; x += 1) {
        const owner = board[y][x].owner;
        if (!owner) continue;
        territory.set(owner, (territory.get(owner) || 0) + 1);
      }
    }

    frames.push({
      round: round.round,
      board: board.map((row) => [...row]),
      territory,
      source: round
    });
  }

  return frames;
}

export async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function normalizedSchemaVersion(version: string | undefined): string {
  return version?.trim() ? version : "0.9";
}

export function schemaWarningFor(version: string): string {
  const major = version.split(".")[0] || "0";
  if (major !== "1") {
    return `Replay schema ${version} may be incompatible with this viewer. Trying to load it anyway.`;
  }
  return "";
}
