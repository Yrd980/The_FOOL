import type { TurnAction, TurnDecision, TurnIntent } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(asNumber(value, fallback));
  return Math.max(min, Math.min(max, n));
}

function normalizeId(value: unknown, fallback: string): string {
  const text = asString(value, fallback).trim();
  if (/^[a-zA-Z0-9_-]{1,24}$/.test(text)) return text;
  return fallback;
}

function toIntent(value: unknown, fallback: TurnIntent): TurnIntent {
  const text = asString(value, "").trim().toLowerCase();
  const map: Record<string, TurnIntent> = {
    expand: "expand",
    expansion: "expand",
    attack: "revenge",
    invade: "revenge",
    revenge: "revenge",
    defend: "defend",
    defense: "defend",
    cooperate: "cooperate",
    alliance: "cooperate",
    betray: "betray",
    art_focus: "art_focus",
    art: "art_focus"
  };
  return map[text] ?? fallback;
}

function parseCoords(value: unknown): { x: number; y: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = asFiniteNumber(value[0]);
    const y = asFiniteNumber(value[1]);
    if (x === null || y === null) return null;
    return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
  }

  if (isRecord(value)) {
    if ("x" in value && "y" in value) {
      const x = asFiniteNumber(value.x);
      const y = asFiniteNumber(value.y);
      if (x === null || y === null) return null;
      return {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y))
      };
    }
    if ("row" in value && "col" in value) {
      const col = asFiniteNumber(value.col);
      const row = asFiniteNumber(value.row);
      if (col === null || row === null) return null;
      return {
        x: Math.max(0, Math.round(col)),
        y: Math.max(0, Math.round(row))
      };
    }
  }

  if (typeof value === "string") {
    const matches = value.match(/(-?\d+)[,\s]+(-?\d+)/);
    if (matches) {
      return {
        x: Math.max(0, Math.round(asNumber(matches[1], 0))),
        y: Math.max(0, Math.round(asNumber(matches[2], 0)))
      };
    }
  }

  return null;
}

function normalizeActionName(value: unknown): TurnAction["action"] | null {
  const text = asString(value, "").trim().toLowerCase();
  if (text === "paint" || text === "draw") return "paint";
  if (text === "fortify" || text === "defend" || text === "shield") return "fortify";
  if (text === "invade" || text === "attack") return "invade";
  if (text === "burst" || text === "bomb" || text === "blast") return "burst";
  if (text === "wait" || text === "hold" || text === "pass") return "wait";
  return null;
}

function getCandidateCoords(actionRecord: UnknownRecord, root: UnknownRecord): { x: number; y: number } | null {
  return (
    parseCoords(actionRecord.target) ||
    parseCoords(actionRecord.target_coords) ||
    parseCoords(actionRecord.target_coordinates) ||
    parseCoords(actionRecord.target_coordinate) ||
    parseCoords({ x: actionRecord.x, y: actionRecord.y }) ||
    parseCoords(root.target) ||
    parseCoords(root.target_coords) ||
    parseCoords(root.target_coordinates) ||
    parseCoords(root.target_coordinate)
  );
}

function normalizeSingleAction(actionLike: unknown, root: UnknownRecord, color: string): TurnAction | null {
  if (typeof actionLike === "string") {
    const name = normalizeActionName(actionLike);
    if (!name) return null;
    if (name === "wait") return { action: "wait" };
    const coords = getCandidateCoords({ action: name }, root);
    if (!coords) return null;
    if (name === "paint") return { action: "paint", x: coords.x, y: coords.y, color };
    if (name === "burst") return { action: "burst", center_x: coords.x, center_y: coords.y, radius: 1 };
    return { action: name, x: coords.x, y: coords.y };
  }

  if (!isRecord(actionLike)) return null;

  const name = normalizeActionName(actionLike.action ?? actionLike.type ?? actionLike.move);
  if (!name) return null;
  if (name === "wait") return { action: "wait" };

  if (name === "burst") {
    const center = parseCoords({
      x: actionLike.center_x ?? actionLike.x,
      y: actionLike.center_y ?? actionLike.y
    }) ?? getCandidateCoords(actionLike, root);
    if (!center) return null;
    return { action: "burst", center_x: center.x, center_y: center.y, radius: 1 };
  }

  const coords = getCandidateCoords(actionLike, root);
  if (!coords) return null;

  if (name === "paint") {
    const pickedColor = /^#[0-9A-Fa-f]{6}$/.test(asString(actionLike.color, "")) ? asString(actionLike.color) : color;
    return { action: "paint", x: coords.x, y: coords.y, color: pickedColor };
  }

  return { action: name, x: coords.x, y: coords.y };
}

function normalizeActions(root: UnknownRecord, color: string): TurnAction[] {
  const source = root.actions;
  const actions: TurnAction[] = [];

  if (Array.isArray(source)) {
    for (const candidate of source) {
      const action = normalizeSingleAction(candidate, root, color);
      if (action) actions.push(action);
      if (actions.length >= 3) break;
    }
  } else if (source !== undefined) {
    const action = normalizeSingleAction(source, root, color);
    if (action) actions.push(action);
  } else if (root.action !== undefined) {
    const action = normalizeSingleAction(root.action, root, color);
    if (action) actions.push(action);
  }

  if (actions.length === 0) {
    actions.push({ action: "wait" });
  }

  return actions.slice(0, 3);
}

function normalizePrivateMessages(root: UnknownRecord, fallbackTargetId: string): TurnDecision["private_messages"] {
  const source = root.private_messages ?? root.private_message ?? [];
  const list = Array.isArray(source) ? source : [source];

  const messages: TurnDecision["private_messages"] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const target = normalizeId(item.target_id ?? item.target ?? item.to, fallbackTargetId);
    const content = asString(item.content ?? item.message ?? item.text, "").slice(0, 50);
    if (!content) continue;
    messages.push({ target_id: target, content });
    if (messages.length >= 2) break;
  }
  return messages;
}

function normalizeTreatyType(value: unknown): "no_attack" | "joint_attack" {
  const text = asString(value, "").trim().toLowerCase();
  if (text === "joint_attack" || text === "joint-attack" || text === "allied_attack") {
    return "joint_attack";
  }
  return "no_attack";
}

function normalizeTreatyProposals(
  root: UnknownRecord,
  agentId: string,
  round: number
): TurnDecision["treaty_proposals"] {
  const source = root.treaty_proposals ?? root.treaty_proposal ?? [];
  const list = Array.isArray(source) ? source : [source];

  const proposals: TurnDecision["treaty_proposals"] = [];
  let index = 0;
  for (const item of list) {
    if (!isRecord(item)) continue;
    index += 1;
    const target = normalizeId(item.target_id ?? item.target ?? item.to, agentId);
    const type = normalizeTreatyType(item.type);
    const duration = clampInt(item.duration_rounds ?? item.duration, 1, 5, 2);
    const proposalId = normalizeId(item.proposal_id, `${agentId}_r${round}_p${index}`);
    const targetEnemyId = item.target_enemy_id ? normalizeId(item.target_enemy_id, agentId) : undefined;
    proposals.push({
      proposal_id: proposalId,
      target_id: target,
      type,
      duration_rounds: duration,
      ...(targetEnemyId ? { target_enemy_id: targetEnemyId } : {})
    });
    if (proposals.length >= 2) break;
  }
  return proposals;
}

function normalizeEmotionDelta(root: UnknownRecord): TurnDecision["emotion_delta"] {
  const source =
    (isRecord(root.emotion_delta) && root.emotion_delta) ||
    (isRecord(root.mood_delta) && root.mood_delta) ||
    (isRecord(root.emotion_change) && root.emotion_change) ||
    (isRecord(root.mood_change) && root.mood_change) ||
    {};

  return {
    anger: clampInt((source as UnknownRecord).anger ?? (source as UnknownRecord).angry, -20, 20, 0),
    fear: clampInt((source as UnknownRecord).fear ?? (source as UnknownRecord).anxiety, -20, 20, 0),
    confidence: clampInt(
      (source as UnknownRecord).confidence ?? (source as UnknownRecord).confident,
      -20,
      20,
      0
    ),
    satisfaction: clampInt((source as UnknownRecord).satisfaction ?? (source as UnknownRecord).happiness, -20, 20, 0)
  };
}

function deriveIntent(root: UnknownRecord, actions: TurnAction[]): TurnIntent {
  const explicit = toIntent(root.intent ?? root.strategy, "expand");
  if (explicit !== "expand") return explicit;

  const primary = actions[0];
  if (!primary) return "expand";
  if (primary.action === "invade" || primary.action === "burst") return "revenge";
  if (primary.action === "fortify") return "defend";
  if (primary.action === "wait") return "cooperate";
  return "expand";
}

export function normalizeTurnDecision({
  raw,
  agentId,
  round,
  color
}: {
  raw: unknown;
  agentId: string;
  round: number;
  color: string;
}): TurnDecision {
  const root = isRecord(raw) ? raw : {};
  const actions = normalizeActions(root, color);
  const intent = deriveIntent(root, actions);

  const publicMessage = asString(root.public_message ?? root.message ?? root.public, "holding").slice(0, 60);
  const reason = asString(root.mood_change_reason ?? root.mood_change ?? root.reason, "no notable change").slice(0, 60);

  return {
    agent_id: normalizeId(root.agent_id ?? root.id, agentId),
    round: clampInt(root.round, 1, 9999, round),
    intent,
    public_message: publicMessage || "holding",
    private_messages: normalizePrivateMessages(root, agentId),
    treaty_proposals: normalizeTreatyProposals(root, agentId, round),
    actions,
    emotion_delta: normalizeEmotionDelta(root),
    mood_change_reason: reason || "no notable change"
  };
}
