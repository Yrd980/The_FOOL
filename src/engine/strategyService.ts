import { boundDecision } from "./decisionService";
import { ACTION_COST } from "./constants";
import { collectContestedHotspots, collectOwnedCells, mergeUniquePoints, neighbors4, randomPoints, selectUniquePoints, type CanvasCell } from "./canvasRuntime";
import { sharedHistory } from "./socialState";
import type { ActionHints, AgentState, ArtDirection, ArtZone, MemoryEvent, Point, TurnAction, TurnDecision } from "../types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function relationToMap(relations: AgentState["relations"]): Map<string, AgentState["relations"][number]> {
  const map = new Map<string, AgentState["relations"][number]>();
  for (const relation of relations) {
    map.set(relation.target_id, relation);
  }
  return map;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return { r: 0, g: 0, b: 0 };
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function colorDistance(left: string, right: string): number {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function preferredZoneKindsForAgent(agent: AgentState): ArtZone["kind"][] {
  const kinds: ArtZone["kind"][] = [];
  if (agent.identity_dna.creativity_bias >= 70) kinds.push("center_halo", "spiral");
  if (agent.identity_dna.aggression_bias >= 65) kinds.push("diagonal_rift");
  if (agent.identity_dna.diplomacy_bias >= 65) kinds.push("horizon_band");
  if (agent.identity_dna.risk_appetite <= 40) kinds.push("corner_sigils");
  if (kinds.length === 0) kinds.push("center_halo", "diagonal_rift");
  return [...new Set(kinds)];
}

function mythPaletteCandidatesForAgent(artDirection: ArtDirection, agent: AgentState): string[] {
  const zones = artDirection.zone_guides.filter((zone) => preferredZoneKindsForAgent(agent).includes(zone.kind));
  const colors = zones.flatMap((zone) => zone.preferred_palette).concat(artDirection.palette);
  return [...new Set(colors)].slice(0, 8);
}

function mythFocusPoints({
  agent,
  width,
  height,
  artDirection,
  zoneWeight
}: {
  agent: AgentState;
  width: number;
  height: number;
  artDirection: ArtDirection;
  zoneWeight: (zone: ArtZone, x: number, y: number) => number;
}): Point[] {
  const preferredKinds = preferredZoneKindsForAgent(agent);
  const scored: Array<Point & { weight: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const weight = artDirection.zone_guides.reduce((sum, zone) => {
        const raw = zoneWeight(zone, x, y) * (zone.emphasis / 100);
        return sum + (preferredKinds.includes(zone.kind) ? raw * 1.5 : raw * 0.55);
      }, 0);
      if (weight < 0.3) continue;
      scored.push({ x, y, weight });
    }
  }

  return scored
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 60)
    .map(({ x, y }) => ({ x, y }));
}

export function mythAestheticScore({
  agent,
  board,
  width,
  height,
  artDirection,
  artTargetColors,
  zoneWeight
}: {
  agent: AgentState;
  board: CanvasCell[][];
  width: number;
  height: number;
  artDirection: ArtDirection;
  artTargetColors: string[][];
  zoneWeight: (zone: ArtZone, x: number, y: number) => number;
}): number {
  let total = 0;
  let count = 0;
  const preferredKinds = preferredZoneKindsForAgent(agent);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = board[y][x];
      if (cell.owner !== agent.id) continue;
      const preferredColor = artTargetColors[y][x];
      const colorScore = 1 - colorDistance(cell.color, preferredColor) / 441.6729559;
      const zoneScore = artDirection.zone_guides.reduce((best, zone) => {
        const raw = zoneWeight(zone, x, y);
        return preferredKinds.includes(zone.kind) ? Math.max(best, raw * 1.2) : Math.max(best, raw * 0.6);
      }, 0);
      total += clamp(colorScore * 70 + zoneScore * 30, 0, 100);
      count += 1;
    }
  }

  return count > 0 ? total / count : 0;
}

function targetMismatchAt(board: CanvasCell[][], artTargetColors: string[][], x: number, y: number): number {
  const targetColor = artTargetColors[y]?.[x];
  if (!targetColor) return 0;
  const cell = board[y][x];
  const distance = colorDistance(cell.color, targetColor);
  if (!cell.owner) {
    return distance + 110;
  }
  return distance;
}

function targetPriorityPoints({
  agent,
  board,
  width,
  height,
  artDirection,
  artTargetColors,
  zoneWeight
}: {
  agent: AgentState;
  board: CanvasCell[][];
  width: number;
  height: number;
  artDirection: ArtDirection;
  artTargetColors: string[][];
  zoneWeight: (zone: ArtZone, x: number, y: number) => number;
}): { paint: Point[]; invade: Point[]; fortify: Point[] } {
  const preferredKinds = preferredZoneKindsForAgent(agent);
  const paint: Array<Point & { score: number }> = [];
  const invade: Array<Point & { score: number }> = [];
  const fortify: Array<Point & { score: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = board[y][x];
      const mismatch = targetMismatchAt(board, artTargetColors, x, y);
      if (mismatch < 18) continue;

      const zoneBias = artDirection.zone_guides.reduce((sum, zone) => {
        const raw = zoneWeight(zone, x, y) * (zone.emphasis / 100);
        return sum + (preferredKinds.includes(zone.kind) ? raw * 1.5 : raw * 0.4);
      }, 0);

      const score = mismatch + zoneBias * 100;
      if (!cell.owner || cell.owner === agent.id) {
        paint.push({ x, y, score });
        if (cell.owner === agent.id && cell.fortify < 1 && zoneBias > 0.35) {
          fortify.push({ x, y, score: score * 0.7 });
        }
      } else {
        invade.push({ x, y, score });
      }
    }
  }

  const pick = (items: Array<Point & { score: number }>, limit: number): Point[] =>
    items
      .sort((left, right) => right.score - left.score)
      .slice(0, limit * 4)
      .map(({ x, y }) => ({ x, y }));

  return {
    paint: pick(paint, 14),
    invade: pick(invade, 10),
    fortify: pick(fortify, 8)
  };
}

export function buildActionHints({
  agent,
  round,
  board,
  width,
  height,
  events,
  artDirection,
  artTargetColors,
  zoneWeight
}: {
  agent: AgentState;
  round: number;
  board: CanvasCell[][];
  width: number;
  height: number;
  events: MemoryEvent[];
  artDirection: ArtDirection;
  artTargetColors: string[][];
  zoneWeight: (zone: ArtZone, x: number, y: number) => number;
}): ActionHints {
  const ownedCells = collectOwnedCells(board, width, height, agent.id);
  const paintRaw: Point[] = [];
  const fortifyRaw: Point[] = [];
  const invadeRaw: Point[] = [];
  const burstRaw: Point[] = [];
  const targetPriority = targetPriorityPoints({ agent, board, width, height, artDirection, artTargetColors, zoneWeight });

  for (const own of ownedCells) {
    let hasEnemyNeighbor = false;
    for (const neighbor of neighbors4(width, height, own.x, own.y)) {
      const owner = board[neighbor.y][neighbor.x].owner;
      if (owner === agent.id) continue;
      if (owner === null) {
        paintRaw.push(neighbor);
        continue;
      }
      invadeRaw.push(neighbor);
      burstRaw.push(neighbor);
      hasEnemyNeighbor = true;
    }

    if (hasEnemyNeighbor || board[own.y][own.x].fortify < 2) {
      fortifyRaw.push(own);
    }
    if (hasEnemyNeighbor) {
      burstRaw.push(own);
    }
  }

  const hotspots = collectContestedHotspots(events, round, width, height);
  const mythRaw = mythFocusPoints({ agent, width, height, artDirection, zoneWeight });
  for (const point of hotspots) {
    const owner = board[point.y][point.x].owner;
    if (owner !== agent.id) {
      invadeRaw.push(point);
      burstRaw.push(point);
    }
    if (owner === null) {
      paintRaw.push(point);
    }
  }

  if (paintRaw.length === 0) {
    const fallback = ownedCells.length > 0 ? ownedCells : randomPoints(width, height, 8);
    for (const origin of fallback) {
      for (const neighbor of neighbors4(width, height, origin.x, origin.y)) {
        if (board[neighbor.y][neighbor.x].owner !== agent.id) {
          paintRaw.push(neighbor);
        }
      }
    }
  }

  if (fortifyRaw.length === 0 && ownedCells.length > 0) {
    fortifyRaw.push(...ownedCells);
  }

  if (invadeRaw.length === 0 && hotspots.length > 0) {
    invadeRaw.push(...hotspots);
  }

  if (burstRaw.length === 0) {
    burstRaw.push(...invadeRaw, ...paintRaw);
  }

  return {
    paint_candidates: mergeUniquePoints(
      targetPriority.paint,
      mergeUniquePoints(mythRaw, paintRaw.length > 0 ? paintRaw : randomPoints(width, height, 10), 16),
      14
    ),
    fortify_candidates: mergeUniquePoints(targetPriority.fortify, fortifyRaw.length > 0 ? fortifyRaw : randomPoints(width, height, 8), 8),
    invade_candidates: mergeUniquePoints(
      targetPriority.invade,
      mergeUniquePoints(hotspots, invadeRaw.length > 0 ? invadeRaw : randomPoints(width, height, 10), 14),
      10
    ),
    burst_centers: mergeUniquePoints(
      targetPriority.invade,
      mergeUniquePoints(hotspots, burstRaw.length > 0 ? burstRaw : randomPoints(width, height, 8), 12),
      8
    ),
    contested_hotspots: selectUniquePoints(hotspots, 6),
    palette_candidates: mythPaletteCandidatesForAgent(artDirection, agent),
    motif_focus: artDirection.zone_guides
      .filter((zone) => preferredZoneKindsForAgent(agent).includes(zone.kind))
      .map((zone) => `${zone.label}: ${zone.motif}`)
      .slice(0, 4)
  };
}

function actionEnergyCost(action: TurnAction): number {
  return ACTION_COST[action.action];
}

function actionKey(action: TurnAction): string {
  if (action.action === "wait") return "wait";
  if (action.action === "burst") return `${action.action}:${action.center_x},${action.center_y}`;
  return `${action.action}:${action.x},${action.y}`;
}

function stylePublicMessage(agent: AgentState, message: string): string {
  const trimmed = message.trim();
  if (trimmed.length > 10) {
    return trimmed.slice(0, 60);
  }

  const style = agent.identity_dna.speech_style.toLowerCase();
  if (style.includes("poetic") || style.includes("expressive")) {
    return "Let this move leave a signature.".slice(0, 60);
  }
  if (style.includes("calm") || style.includes("tactical")) {
    return "Steady hands, measured pressure.".slice(0, 60);
  }
  if (style.includes("ironic") || style.includes("manipulative")) {
    return "One move now, two outcomes later.".slice(0, 60);
  }
  if (style.includes("assertive") || style.includes("territorial")) {
    return "Forward line first. Claim and hold.".slice(0, 60);
  }
  return `${agent.identity_dna.archetype}: staying in character.`.slice(0, 60);
}

export function personalMythReading(agent: AgentState, artDirection: ArtDirection): string {
  const preferredKinds = preferredZoneKindsForAgent(agent)
    .map((kind) => artDirection.zone_guides.find((zone) => zone.kind === kind)?.label)
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);

  return [
    `${agent.identity_dna.archetype} sees this mural as ${artDirection.motifs.slice(0, 2).join(" and ")}.`,
    `Preferred zones: ${preferredKinds.join(", ") || "Core Halo"}.`,
    `Core values to preserve: ${agent.identity_dna.core_values.slice(0, 2).join(", ")}.`
  ].join(" ");
}

function stablePairBias(agentId: string, targetId: string, round: number): number {
  const key = `${agentId}:${targetId}:${round}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 9973;
  }
  return (hash % 100) / 100;
}

function pickDiplomaticTarget(agents: AgentState[], agent: AgentState, round: number): string | null {
  const relationMap = relationToMap(agent.relations);

  const ranked = agents
    .filter((target) => target.id !== agent.id)
    .map((target) => {
      const relation = relationMap.get(target.id) ?? { target_id: target.id, trust: 0, affinity: 0, debt: 0 };
      const compatibility =
        100 -
        Math.abs(agent.identity_dna.diplomacy_bias - target.identity_dna.diplomacy_bias) * 0.5 -
        Math.abs(agent.identity_dna.risk_appetite - target.identity_dna.risk_appetite) * 0.2;
      const historyBoost = sharedHistory(agent, target.id).length * 5;
      const tensionPenalty = Math.max(0, relation.debt) * 0.6 + Math.max(0, -relation.trust) * 0.4;
      const score =
        relation.trust * 0.7 +
        relation.affinity * 0.55 -
        tensionPenalty +
        compatibility * 0.18 +
        target.reputation * 0.05 +
        historyBoost +
        stablePairBias(agent.id, target.id, round) * 12;

      return { id: target.id, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.id ?? null;
}

export function applyIdentitySteering({
  agent,
  decision,
  hints,
  round,
  width,
  height,
  agents,
  mythColorForPoint
}: {
  agent: AgentState;
  decision: TurnDecision;
  hints: ActionHints;
  round: number;
  width: number;
  height: number;
  agents: AgentState[];
  mythColorForPoint: (agent: AgentState, x: number, y: number, requestedColor?: string, round?: number) => string;
}): { decision: TurnDecision; note: string; proactive_score: number } {
  const next: TurnDecision = {
    ...decision,
    public_message: stylePublicMessage(agent, decision.public_message),
    private_messages: [...decision.private_messages],
    treaty_proposals: [...decision.treaty_proposals],
    actions: [...decision.actions],
    emotion_delta: { ...decision.emotion_delta }
  };

  if (next.actions.length === 0) {
    next.actions = [{ action: "wait" }];
  }

  if (next.actions.some((action) => action.action !== "wait")) {
    next.actions = next.actions.filter((action) => action.action !== "wait");
  }

  const notes: string[] = [];
  const used = new Set(next.actions.map((action) => actionKey(action)));

  const remainingEnergy = (): number => Math.max(0, 3 - next.actions.reduce((sum, action) => sum + actionEnergyCost(action), 0));

  const addAction = (action: TurnAction): boolean => {
    if (next.actions.length >= 3) return false;
    if (actionEnergyCost(action) > remainingEnergy()) return false;
    const key = actionKey(action);
    if (used.has(key)) return false;
    next.actions.push(action);
    used.add(key);
    return true;
  };

  const replaceAction = (predicate: (action: TurnAction) => boolean, action: TurnAction): boolean => {
    const index = next.actions.findIndex(predicate);
    if (index < 0) return false;
    const withoutCost = next.actions.reduce((sum, item, i) => (i === index ? sum : sum + actionEnergyCost(item)), 0);
    if (withoutCost + actionEnergyCost(action) > 3) return false;
    next.actions[index] = action;
    used.clear();
    for (const item of next.actions) {
      used.add(actionKey(item));
    }
    return true;
  };

  const pickPaint = (): TurnAction | null => {
    const point = hints.paint_candidates[0];
    if (!point) return null;
    return { action: "paint", x: point.x, y: point.y, color: mythColorForPoint(agent, point.x, point.y, agent.color, round) };
  };

  const pickFortify = (): TurnAction | null => {
    const point = hints.fortify_candidates[0];
    if (!point) return null;
    return { action: "fortify", x: point.x, y: point.y };
  };

  const pickInvade = (): TurnAction | null => {
    const point = hints.invade_candidates[0];
    if (!point) return null;
    return { action: "invade", x: point.x, y: point.y };
  };

  const hasAction = (kind: TurnAction["action"]): boolean => next.actions.some((action) => action.action === kind);

  const dna = agent.identity_dna;
  const values = dna.core_values.map((value) => value.toLowerCase());
  const wantsPaint = dna.creativity_bias >= 65 || values.some((value) => value.includes("beauty") || value.includes("legacy"));
  const wantsFortify = dna.risk_appetite <= 45 || values.some((value) => value.includes("stability") || value.includes("honor"));
  const wantsInvade = dna.aggression_bias >= 65 || values.some((value) => value.includes("pressure") || value.includes("advantage"));
  const wantsDiplomacy = dna.diplomacy_bias >= 65 || values.some((value) => value.includes("honor") || value.includes("alliance"));

  if (wantsPaint && !hasAction("paint")) {
    const action = pickPaint();
    if (action && (addAction(action) || replaceAction((item) => item.action === "invade", action))) {
      notes.push("按创作倾向补充绘制动作");
      next.intent = "art_focus";
    }
  }

  if (wantsFortify && !hasAction("fortify")) {
    const action = pickFortify();
    if (action && (addAction(action) || replaceAction((item) => item.action === "invade", action))) {
      notes.push("按稳健倾向加强边界防御");
      if (!hasAction("invade")) {
        next.intent = "defend";
      }
    }
  }

  if (wantsInvade && !hasAction("invade")) {
    const action = pickInvade();
    if (action && addAction(action)) {
      notes.push("按进攻倾向维持威慑压力");
      if (!hasAction("fortify")) {
        next.intent = "revenge";
      }
    }
  }

  if (wantsDiplomacy && next.treaty_proposals.length === 0) {
    const target = pickDiplomaticTarget(agents, agent, round);
    if (target) {
      next.treaty_proposals.push({
        proposal_id: `${agent.id}_r${round}_dna`,
        target_id: target,
        type: "no_attack",
        duration_rounds: 2
      });
      if (next.private_messages.length < 2) {
        next.private_messages.push({ target_id: target, content: "保持边界稳定，两回合互不攻击。" });
      }
      notes.push("按关系倾向补充外交动作");
    }
  }

  if (!hasAction("invade") && !hasAction("paint") && !hasAction("fortify")) {
    const action = pickPaint() ?? pickFortify() ?? pickInvade();
    if (action && addAction(action)) {
      notes.push("避免空转，执行最符合当前身份的动作");
      next.intent = "expand";
    }
  }

  if (next.actions.length === 0) {
    next.actions = [{ action: "wait" }];
  }

  next.actions = next.actions.slice(0, 3);

  const activityWeight = next.actions.reduce((sum, action) => {
    if (action.action === "wait") return sum;
    if (action.action === "invade" || action.action === "burst") return sum + 2;
    return sum + 1;
  }, 0);
  const proactiveScore = clamp(Math.round((activityWeight / 6) * 100), 0, 100);

  const notePrefix = `${agent.identity_dna.archetype}(${agent.identity_dna.core_values.slice(0, 2).join("/")})`;
  const note = notes.length > 0 ? `${notePrefix}: ${notes.join("；")}` : `${notePrefix}: 行为保持人格一致`;

  return {
    decision: boundDecision(next, width, height),
    note,
    proactive_score: proactiveScore
  };
}
