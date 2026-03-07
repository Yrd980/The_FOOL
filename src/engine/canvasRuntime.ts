import { ACTION_COST } from "./constants";
import { hasNoAttackTreaty } from "./socialState";
import type { AgentState, MemoryEvent, Point, ReplayRound, Treaty, TurnAction } from "../types";

export interface CanvasCell {
  owner: string | null;
  color: string;
  fortify: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createBoard(width: number, height: number): CanvasCell[][] {
  const board: CanvasCell[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: CanvasCell[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push({ owner: null, color: "#111111", fortify: 0 });
    }
    board.push(row);
  }
  return board;
}

export function inBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function neighbors4(width: number, height: number, x: number, y: number): Point[] {
  const deltas: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  const output: Point[] = [];
  for (const [dx, dy] of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(width, height, nx, ny)) {
      output.push({ x: nx, y: ny });
    }
  }
  return output;
}

export function squarePoints(width: number, height: number, centerX: number, centerY: number, radius: number): Point[] {
  const points: Point[] = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (inBounds(width, height, x, y)) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

export function diamondPoints(width: number, height: number, centerX: number, centerY: number, radius: number): Point[] {
  const points: Point[] = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const x = centerX + dx;
      const y = centerY + dy;
      if (inBounds(width, height, x, y)) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

export function recordCanvasUpdate({
  board,
  width,
  height,
  currentRoundUpdateMap,
  x,
  y
}: {
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
  x: number;
  y: number;
}): void {
  if (!inBounds(width, height, x, y)) return;
  const cell = board[y][x];
  currentRoundUpdateMap.set(`${x},${y}`, {
    x,
    y,
    owner: cell.owner,
    color: cell.color
  });
}

export function setCellState({
  board,
  width,
  height,
  currentRoundUpdateMap,
  x,
  y,
  owner,
  color,
  fortify
}: {
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
  x: number;
  y: number;
  owner: string | null;
  color: string;
  fortify?: number;
}): void {
  if (!inBounds(width, height, x, y)) return;
  board[y][x].owner = owner;
  board[y][x].color = color;
  if (typeof fortify === "number") {
    board[y][x].fortify = fortify;
  }
  recordCanvasUpdate({ board, width, height, currentRoundUpdateMap, x, y });
}

export function currentFillRate(board: CanvasCell[][], width: number, height: number): number {
  let occupied = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (board[y][x].owner) occupied += 1;
    }
  }
  return occupied / (width * height);
}

export function paintBrushRadius(board: CanvasCell[][], width: number, height: number, agent: AgentState): number {
  const fillRate = currentFillRate(board, width, height);
  let radius = fillRate < 0.12 ? 3 : fillRate < 0.45 ? 2 : 1;
  if (agent.identity_dna.creativity_bias >= 80 && fillRate < 0.7) {
    radius += 1;
  }
  if (agent.identity_dna.risk_appetite <= 30) {
    radius -= 1;
  }
  return clamp(radius, 1, 4);
}

export function countOwnedNeighbors(board: CanvasCell[][], width: number, height: number, agentId: string, x: number, y: number): number {
  let count = 0;
  for (const point of neighbors4(width, height, x, y)) {
    if (board[point.y][point.x].owner === agentId) {
      count += 1;
    }
  }
  return count;
}

export function selectUniquePoints(points: Point[], limit: number): Point[] {
  const selected: Point[] = [];
  const seen = new Set<string>();
  for (const point of shuffled(points)) {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) continue;
    selected.push(point);
    seen.add(key);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function mergeUniquePoints(primary: Point[], secondary: Point[], limit: number): Point[] {
  const output: Point[] = [];
  const seen = new Set<string>();
  for (const point of [...primary, ...secondary]) {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) continue;
    output.push(point);
    seen.add(key);
    if (output.length >= limit) break;
  }
  return output;
}

export function collectOwnedCells(board: CanvasCell[][], width: number, height: number, agentId: string): Point[] {
  const owned: Point[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (board[y][x].owner === agentId) {
        owned.push({ x, y });
      }
    }
  }
  return owned;
}

export function parseCoordTarget(target: string | undefined, width: number, height: number): Point | null {
  if (!target) return null;
  const match = target.match(/^(-?\d+),(-?\d+)$/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!inBounds(width, height, x, y)) return null;
  return { x, y };
}

export function collectContestedHotspots(events: MemoryEvent[], round: number, width: number, height: number): Point[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.round !== round - 1) continue;
    const coord = parseCoordTarget(event.target, width, height);
    if (!coord) continue;
    const key = `${coord.x},${coord.y}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const hotspots: Point[] = [];
  for (const [key, count] of counts.entries()) {
    if (count < 2) continue;
    const [xText, yText] = key.split(",");
    hotspots.push({ x: Number(xText), y: Number(yText) });
  }
  return hotspots;
}

export function randomPoints(width: number, height: number, limit: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < limit * 3; i += 1) {
    points.push({ x: randomInt(width), y: randomInt(height) });
  }
  return selectUniquePoints(points, limit);
}

export function occupiedCellCount(board: CanvasCell[][], width: number, height: number): number {
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (board[y][x].owner) count += 1;
    }
  }
  return count;
}

export function alignedCellCount(board: CanvasCell[][], artTargetColors: string[][], width: number, height: number): number {
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = board[y][x];
      if (!cell.owner) continue;
      if (cell.color === artTargetColors[y][x]) count += 1;
    }
  }
  return count;
}

export function seedCurrentRoundWithBoard({
  board,
  width,
  height,
  currentRoundUpdateMap
}: {
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
}): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!board[y][x].owner) continue;
      recordCanvasUpdate({ board, width, height, currentRoundUpdateMap, x, y });
    }
  }
}

export function applyActionToCanvas({
  agent,
  action,
  round,
  board,
  width,
  height,
  currentRoundUpdateMap,
  activeTreaties,
  events,
  mythColorForPoint
}: {
  agent: AgentState;
  action: TurnAction;
  round: number;
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
  activeTreaties: Treaty[];
  events: MemoryEvent[];
  mythColorForPoint: (agent: AgentState, x: number, y: number, requestedColor?: string, round?: number) => string;
}): void {
  const cost = ACTION_COST[action.action];
  if (cost > agent.energy) return;

  if (action.action === "wait") {
    agent.energy -= cost;
    return;
  }

  if (action.action === "paint") {
    if (!inBounds(width, height, action.x, action.y)) return;
    agent.energy -= cost;
    const stroke = squarePoints(width, height, action.x, action.y, paintBrushRadius(board, width, height, agent));
    for (const point of stroke) {
      const cell = board[point.y][point.x];
      if (cell.owner && cell.owner !== agent.id) continue;

      const wasEmpty = !cell.owner;
      const nextColor = mythColorForPoint(agent, point.x, point.y, action.color, round);
      setCellState({
        board,
        width,
        height,
        currentRoundUpdateMap,
        x: point.x,
        y: point.y,
        owner: agent.id,
        color: nextColor,
        fortify: 0
      });
      if (wasEmpty) {
        events.push({ round, type: "expanded", by: agent.id, target: `${point.x},${point.y}` });
      }
    }
    return;
  }

  if (action.action === "fortify") {
    if (!inBounds(width, height, action.x, action.y)) return;
    if (board[action.y][action.x].owner !== agent.id) return;
    agent.energy -= cost;
    for (const point of diamondPoints(width, height, action.x, action.y, 1)) {
      const cell = board[point.y][point.x];
      if (cell.owner !== agent.id) continue;
      setCellState({
        board,
        width,
        height,
        currentRoundUpdateMap,
        x: point.x,
        y: point.y,
        owner: agent.id,
        color: cell.color,
        fortify: clamp(cell.fortify + 1, 0, 3)
      });
    }
    return;
  }

  if (action.action === "invade") {
    if (!inBounds(width, height, action.x, action.y)) return;
    const targetCell = board[action.y][action.x];
    const defenderId = targetCell.owner;
    if (!defenderId || defenderId === agent.id) return;

    const neighbors = countOwnedNeighbors(board, width, height, agent.id, action.x, action.y);
    if (neighbors === 0) return;

    if (hasNoAttackTreaty(activeTreaties, agent.id, defenderId, round)) {
      agent.reputation = clamp(agent.reputation - 20, 0, 100);
      const relation = agent.relations.find((item) => item.target_id === defenderId);
      if (relation) {
        relation.trust = clamp(relation.trust - 25, -100, 100);
      }
      events.push({ round, type: "broke_treaty", by: agent.id, target: defenderId });
    }

    agent.energy -= cost;
    const attackPower =
      1 + neighbors * 0.4 + agent.emotion.anger * 0.01 + agent.emotion.confidence * 0.008 + Math.random() * 0.25;
    const defendPower = 1 + targetCell.fortify * 0.6 + Math.random() * 0.25;

    if (attackPower >= defendPower) {
      const footprint = diamondPoints(width, height, action.x, action.y, 1);
      let captured = 0;
      for (const point of footprint) {
        const cell = board[point.y][point.x];
        if (!cell.owner || cell.owner === agent.id) continue;
        const pointNeighbors = countOwnedNeighbors(board, width, height, agent.id, point.x, point.y);
        const localAttackPower = attackPower + pointNeighbors * 0.35 + agent.identity_dna.aggression_bias * 0.002 + Math.random() * 0.15;
        const localDefendPower = 1 + cell.fortify * 0.6 + Math.random() * 0.2;
        if (localAttackPower < localDefendPower) continue;
        const previousOwner = cell.owner;
        setCellState({
          board,
          width,
          height,
          currentRoundUpdateMap,
          x: point.x,
          y: point.y,
          owner: agent.id,
          color: mythColorForPoint(agent, point.x, point.y, agent.color, round),
          fortify: 0
        });
        events.push({ round, type: "attacked", by: agent.id, target: previousOwner });
        if (previousOwner && previousOwner !== agent.id) {
          events.push({ round, type: "lost_area", by: previousOwner, target: agent.id });
        }
        captured += 1;
      }
      if (captured === 0) {
        setCellState({
          board,
          width,
          height,
          currentRoundUpdateMap,
          x: action.x,
          y: action.y,
          owner: agent.id,
          color: mythColorForPoint(agent, action.x, action.y, agent.color, round),
          fortify: 0
        });
        events.push({ round, type: "attacked", by: agent.id, target: defenderId });
      }
      events.push({ round, type: "won_conflict", by: agent.id, target: defenderId });
    }
    return;
  }

  if (!inBounds(width, height, action.center_x, action.center_y)) return;
  if (agent.cooldowns.burst > 0) return;

  agent.energy -= cost;
  agent.cooldowns.burst = 3;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = action.center_x + dx;
      const y = action.center_y + dy;
      if (!inBounds(width, height, x, y)) continue;

      const targetCell = board[y][x];
      const enemy = targetCell.owner && targetCell.owner !== agent.id;
      if (!enemy) continue;

      const nearby = countOwnedNeighbors(board, width, height, agent.id, x, y);
      const chance = 0.15 + nearby * 0.2;
      if (Math.random() < chance) {
        const previousOwner = targetCell.owner;
        setCellState({
          board,
          width,
          height,
          currentRoundUpdateMap,
          x,
          y,
          owner: agent.id,
          color: mythColorForPoint(agent, x, y, agent.color, round),
          fortify: 0
        });
        events.push({ round, type: "attacked", by: agent.id, target: previousOwner ?? undefined });
        if (previousOwner && previousOwner !== agent.id) {
          events.push({ round, type: "lost_area", by: previousOwner, target: agent.id });
        }
      }
    }
  }
}

function fillTowardTarget({
  round,
  budget,
  phase,
  board,
  width,
  height,
  currentRoundUpdateMap,
  events,
  phaseGateAt,
  targetPriorityAt,
  targetMismatchAt,
  getAgentById,
  mythColorForPoint
}: {
  round: number;
  budget: number;
  phase: ReplayRound["art_phase"];
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
  events: MemoryEvent[];
  phaseGateAt: (x: number, y: number, phase: ReplayRound["art_phase"]) => number;
  targetPriorityAt: (x: number, y: number, phase: ReplayRound["art_phase"]) => number;
  targetMismatchAt: (x: number, y: number) => number;
  getAgentById: (agentId: string) => AgentState | undefined;
  mythColorForPoint: (agent: AgentState, x: number, y: number, requestedColor?: string, round?: number) => string;
}): void {
  let remaining = budget;
  if (remaining <= 0) return;

  while (remaining > 0) {
    const candidates = new Map<string, { x: number; y: number; owner: string; color: string; score: number }>();

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = board[y][x];
        if (!cell.owner) continue;
        for (const neighbor of neighbors4(width, height, x, y)) {
          const targetCell = board[neighbor.y][neighbor.x];
          if (targetCell.owner) continue;
          const key = `${neighbor.x},${neighbor.y}`;
          const ownerAgent = getAgentById(cell.owner);
          const gate = phaseGateAt(neighbor.x, neighbor.y, phase);
          if (gate < (phase.id === "resolve" ? 0.05 : 0.22)) continue;
          const score =
            targetPriorityAt(neighbor.x, neighbor.y, phase) +
            targetMismatchAt(neighbor.x, neighbor.y) +
            (ownerAgent?.identity_dna.creativity_bias ?? 50) * 0.6 +
            gate * 80;
          const color = ownerAgent ? mythColorForPoint(ownerAgent, neighbor.x, neighbor.y, cell.color, round) : cell.color;

          const previous = candidates.get(key);
          if (!previous || score > previous.score) {
            candidates.set(key, { x: neighbor.x, y: neighbor.y, owner: cell.owner, color, score });
          }
        }
      }
    }

    if (candidates.size === 0) break;

    const batch = [...candidates.values()].sort((left, right) => right.score - left.score).slice(0, remaining);
    if (batch.length === 0) break;

    for (const item of batch) {
      setCellState({
        board,
        width,
        height,
        currentRoundUpdateMap,
        x: item.x,
        y: item.y,
        owner: item.owner,
        color: item.color,
        fortify: 0
      });
      events.push({ round, type: "expanded", by: item.owner, target: `${item.x},${item.y}` });
    }

    remaining -= batch.length;
    if (batch.length === 0) break;
  }
}

function harmonizeTowardTarget({
  round,
  budget,
  phase,
  board,
  width,
  height,
  currentRoundUpdateMap,
  phaseGateAt,
  targetPriorityAt,
  targetMismatchAt,
  getAgentById,
  mythColorForPoint
}: {
  round: number;
  budget: number;
  phase: ReplayRound["art_phase"];
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
  phaseGateAt: (x: number, y: number, phase: ReplayRound["art_phase"]) => number;
  targetPriorityAt: (x: number, y: number, phase: ReplayRound["art_phase"]) => number;
  targetMismatchAt: (x: number, y: number) => number;
  getAgentById: (agentId: string) => AgentState | undefined;
  mythColorForPoint: (agent: AgentState, x: number, y: number, requestedColor?: string, round?: number) => string;
}): void {
  if (budget <= 0) return;

  const candidates: Array<{ x: number; y: number; owner: string; score: number }> = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = board[y][x];
      if (!cell.owner) continue;
      const mismatch = targetMismatchAt(x, y);
      if (mismatch < 8) continue;
      const gate = phaseGateAt(x, y, phase);
      if (gate < (phase.id === "resolve" ? 0.05 : 0.18)) continue;
      candidates.push({
        x,
        y,
        owner: cell.owner,
        score: mismatch + targetPriorityAt(x, y, phase) * 0.35 + gate * 50
      });
    }
  }

  for (const item of candidates.sort((left, right) => right.score - left.score).slice(0, budget)) {
    const ownerAgent = getAgentById(item.owner);
    if (!ownerAgent) continue;
    const nextColor = mythColorForPoint(ownerAgent, item.x, item.y, board[item.y][item.x].color, round);
    if (nextColor !== board[item.y][item.x].color) {
      setCellState({
        board,
        width,
        height,
        currentRoundUpdateMap,
        x: item.x,
        y: item.y,
        owner: item.owner,
        color: nextColor,
        fortify: board[item.y][item.x].fortify
      });
    }
  }
}

function targetCoverageForRound(round: number, rounds: number): number {
  const progress = round / Math.max(1, rounds);
  return clamp(0.08 + 0.92 * progress * progress * (3 - 2 * progress), 0, 1);
}

export function resolveCanvasProgressively({
  round,
  rounds,
  board,
  width,
  height,
  currentRoundUpdateMap,
  events,
  artTargetColors,
  artPhaseForRound,
  phaseGateAt,
  targetPriorityAt,
  targetMismatchAt,
  getAgentById,
  mythColorForPoint
}: {
  round: number;
  rounds: number;
  board: CanvasCell[][];
  width: number;
  height: number;
  currentRoundUpdateMap: Map<string, ReplayRound["canvas_updates"][number]>;
  events: MemoryEvent[];
  artTargetColors: string[][];
  artPhaseForRound: (round: number) => ReplayRound["art_phase"];
  phaseGateAt: (x: number, y: number, phase: ReplayRound["art_phase"]) => number;
  targetPriorityAt: (x: number, y: number, phase: ReplayRound["art_phase"]) => number;
  targetMismatchAt: (x: number, y: number) => number;
  getAgentById: (agentId: string) => AgentState | undefined;
  mythColorForPoint: (agent: AgentState, x: number, y: number, requestedColor?: string, round?: number) => string;
}): void {
  const totalCells = width * height;
  const targetCoverage = targetCoverageForRound(round, rounds);
  const desiredOccupied = Math.ceil(totalCells * targetCoverage);
  const desiredAligned = Math.ceil(totalCells * Math.min(1, targetCoverage + 0.12));
  const phase = artPhaseForRound(round);

  let fillBudget = Math.max(0, desiredOccupied - occupiedCellCount(board, width, height));
  let harmonizeBudget = Math.max(0, desiredAligned - alignedCellCount(board, artTargetColors, width, height));

  if (phase.id === "block_in") {
    fillBudget = Math.ceil(fillBudget * 0.78);
    harmonizeBudget = Math.ceil(harmonizeBudget * 0.4);
  } else if (phase.id === "silhouette") {
    fillBudget = Math.ceil(fillBudget * 0.85);
    harmonizeBudget = Math.ceil(harmonizeBudget * 0.55);
  } else if (phase.id === "motif") {
    fillBudget = Math.ceil(fillBudget * 0.92);
    harmonizeBudget = Math.ceil(harmonizeBudget * 0.8);
  } else if (phase.id === "background") {
    fillBudget = Math.ceil(fillBudget * 1.05);
    harmonizeBudget = Math.ceil(harmonizeBudget * 0.9);
  }

  fillTowardTarget({
    round,
    budget: fillBudget,
    phase,
    board,
    width,
    height,
    currentRoundUpdateMap,
    events,
    phaseGateAt,
    targetPriorityAt,
    targetMismatchAt,
    getAgentById,
    mythColorForPoint
  });
  harmonizeTowardTarget({
    round,
    budget: harmonizeBudget,
    phase,
    board,
    width,
    height,
    currentRoundUpdateMap,
    phaseGateAt,
    targetPriorityAt,
    targetMismatchAt,
    getAgentById,
    mythColorForPoint
  });
}
