import type { AgentState, SimulationResult } from "../types";

type BoardCell = {
  owner: string | null;
  color: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function territoryMap(agents: AgentState[], board: BoardCell[][], width: number, height: number): Map<string, number> {
  const map = new Map<string, number>(agents.map((agent) => [agent.id, 0]));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const owner = board[y][x].owner;
      if (!owner) continue;
      map.set(owner, (map.get(owner) ?? 0) + 1);
    }
  }
  return map;
}

export function buildScores({
  agents,
  board,
  width,
  height,
  mythAestheticScore
}: {
  agents: AgentState[];
  board: BoardCell[][];
  width: number;
  height: number;
  mythAestheticScore: (agent: AgentState) => number;
}): SimulationResult["ranking"] {
  const total = width * height;
  const territory = territoryMap(agents, board, width, height);

  const scores = agents.map((agent) => {
    const territoryCells = territory.get(agent.id) ?? 0;
    const territoryScore = (territoryCells / total) * 100;
    const mythScore = mythAestheticScore(agent);
    const artScore =
      18 +
      mythScore * 0.72 +
      agent.emotion.confidence * 0.08 +
      agent.emotion.satisfaction * 0.08 +
      agent.reputation * 0.08 -
      agent.emotion.anger * 0.04;

    const finalScore = 0.42 * territoryScore + 0.58 * clamp(artScore, 0, 100);
    return {
      agent_id: agent.id,
      name: agent.name,
      territory_cells: territoryCells,
      territory_score: Number(territoryScore.toFixed(2)),
      art_score: Number(clamp(artScore, 0, 100).toFixed(2)),
      reputation: agent.reputation,
      final_score: Number(finalScore.toFixed(2))
    };
  });

  return scores.sort((a, b) => b.final_score - a.final_score);
}
