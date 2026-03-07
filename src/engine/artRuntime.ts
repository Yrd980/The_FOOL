import { neighbors4 } from "./canvasRuntime";
import type { AgentState, ArtDirection, ArtZone, ReplayRound } from "../types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
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

function rgbToHex(r: number, g: number, b: number): string {
  return `#${clamp(Math.round(r), 0, 255)
    .toString(16)
    .padStart(2, "0")}${clamp(Math.round(g), 0, 255)
    .toString(16)
    .padStart(2, "0")}${clamp(Math.round(b), 0, 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function blendHexColors(base: string, accent: string, amount: number): string {
  const left = hexToRgb(base);
  const right = hexToRgb(accent);
  const ratio = clamp(amount, 0, 1);
  return rgbToHex(
    left.r + (right.r - left.r) * ratio,
    left.g + (right.g - left.g) * ratio,
    left.b + (right.b - left.b) * ratio
  );
}

function colorDistance(left: string, right: string): number {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function motifMask({
  width,
  height,
  motif,
  zone,
  x,
  y
}: {
  width: number;
  height: number;
  motif: string;
  zone: ArtZone;
  x: number;
  y: number;
}): number {
  const nx = x / Math.max(1, width - 1);
  const ny = y / Math.max(1, height - 1);
  const centerX = zone.kind === "corner_sigils" ? (nx < 0.5 ? 0.12 : 0.88) : 0.5 + (zone.kind === "center_halo" ? zone.offset : 0);
  const centerY = zone.kind === "corner_sigils" ? (ny < 0.5 ? 0.12 : 0.88) : zone.kind === "horizon_band" ? zone.offset : 0.5;
  const dx = nx - centerX;
  const dy = ny - centerY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const lower = motif.toLowerCase();

  if (lower.includes("throne") || lower.includes("crown")) {
    const seat = absX < 0.16 && dy > 0.02 && dy < 0.18 ? 1 : 0;
    const back = absX < 0.09 && dy > -0.28 && dy < 0.04 ? 1 : 0;
    const base = absX < 0.22 && dy > 0.16 && dy < 0.26 ? 1 : 0;
    const arms = ((absX > 0.11 && absX < 0.18 && dy > -0.03 && dy < 0.08) ? 1 : 0) * 0.9;
    const spikes = dy < -0.18 && dy > -0.34 && absX < 0.18 && (Math.floor((dx + 0.18) * 18) % 2 === 0 ? 1 : 0);
    return clamp(Math.max(seat, back, base, arms, spikes ? 0.7 : 0), 0, 1);
  }

  if (lower.includes("eye")) {
    const almond = 1 - (absX / 0.26 + absY / 0.12);
    const pupil = absX < 0.03 && absY < 0.03 ? 1 : 0;
    return clamp(Math.max(almond, pupil), 0, 1);
  }

  if (lower.includes("wing")) {
    const wingSpan = 1 - Math.max(0, absY / 0.2 + Math.max(0, absX - 0.08) / 0.28);
    return clamp(wingSpan, 0, 1);
  }

  if (lower.includes("storm") || lower.includes("rift")) {
    const line = 0.46 + zone.offset + Math.sin(nx * Math.PI * 5) * 0.06;
    const dist = Math.abs(ny - line);
    return clamp(1 - dist / 0.05, 0, 1);
  }

  if (lower.includes("banner") || lower.includes("bridge") || lower.includes("arch")) {
    const band = 1 - Math.abs(ny - zone.offset) / 0.05;
    const arch = 1 - Math.abs(Math.hypot(dx, dy + 0.03) - 0.18) / 0.05;
    return clamp(Math.max(band * 0.8, arch), 0, 1);
  }

  if (lower.includes("tide")) {
    const wave = 0.68 + Math.sin(nx * Math.PI * 2.2 + zone.offset * 6) * 0.06;
    return clamp(1 - Math.abs(ny - wave) / 0.08, 0, 1);
  }

  if (lower.includes("sigil")) {
    const diamond = 1 - (absX / 0.09 + absY / 0.09);
    const cross = Math.max(1 - absX / 0.02, 1 - absY / 0.02);
    return clamp(Math.max(diamond, cross * 0.55), 0, 1);
  }

  const angle = Math.atan2(dy, dx) / (Math.PI * 2);
  const dist = Math.hypot(dx, dy);
  const spiral = 1 - Math.abs(dist - (0.02 + ((angle + zone.offset + 1) % 1) * 0.3)) / 0.04;
  return clamp(spiral, 0, 1);
}

export function motifOutlineStrength({
  width,
  height,
  motif,
  zone,
  x,
  y
}: {
  width: number;
  height: number;
  motif: string;
  zone: ArtZone;
  x: number;
  y: number;
}): number {
  const center = motifMask({ width, height, motif, zone, x, y });
  let edge = 0;
  for (const neighbor of neighbors4(width, height, x, y)) {
    const around = motifMask({ width, height, motif, zone, x: neighbor.x, y: neighbor.y });
    edge = Math.max(edge, Math.abs(center - around));
  }
  return clamp(edge, 0, 1);
}

export function zoneWeight(width: number, height: number, zone: ArtZone, x: number, y: number): number {
  const nx = x / Math.max(1, width - 1);
  const ny = y / Math.max(1, height - 1);
  const cx = 0.5 + zone.offset;
  const cy = 0.5;

  if (zone.kind === "center_halo") {
    const dist = Math.hypot(nx - cx, ny - cy);
    return Math.max(0, 1 - dist / Math.max(zone.radius, 0.08));
  }

  if (zone.kind === "diagonal_rift") {
    const line = nx + zone.offset;
    const dist = Math.abs(ny - line);
    return Math.max(0, 1 - dist / Math.max(zone.radius, 0.05));
  }

  if (zone.kind === "horizon_band") {
    const dist = Math.abs(ny - zone.offset);
    return Math.max(0, 1 - dist / Math.max(zone.radius, 0.05));
  }

  if (zone.kind === "corner_sigils") {
    const distances = [
      Math.hypot(nx, ny),
      Math.hypot(1 - nx, ny),
      Math.hypot(nx, 1 - ny),
      Math.hypot(1 - nx, 1 - ny)
    ];
    return Math.max(0, 1 - Math.min(...distances) / Math.max(zone.radius, 0.08));
  }

  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const dist = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) / Math.PI + 1) / 2;
  const spiralBias = 1 - Math.abs(((angle + zone.offset) % 1) - dist) * 1.8;
  return clamp((spiralBias + (1 - dist / Math.max(zone.radius, 0.12))) / 2, 0, 1);
}

function snapToRenderPalette(color: string, renderPalette: string[]): string {
  let winner = renderPalette[0] ?? color;
  let bestDistance = colorDistance(color, winner);

  for (const candidate of renderPalette) {
    const distance = colorDistance(color, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      winner = candidate;
    }
  }

  return winner;
}

export function mythColorForPoint({
  agent,
  x,
  y,
  requestedColor,
  round = 1,
  artTargetColors,
  artDirection,
  renderPalette
}: {
  agent: AgentState;
  x: number;
  y: number;
  requestedColor?: string;
  round?: number;
  artTargetColors: string[][];
  artDirection: ArtDirection;
  renderPalette: string[];
}): string {
  const targetColor = artTargetColors[y]?.[x] ?? artDirection.palette[0] ?? agent.color;
  const blendSource = requestedColor && /^#[0-9A-Fa-f]{6}$/.test(requestedColor) ? requestedColor : agent.color;
  const creativityMix = clamp(agent.identity_dna.creativity_bias / 320, 0.05, 0.18);
  const roundEcho = ((round + hashText(agent.id)) % 3) / 60;
  const mixed = blendHexColors(targetColor, blendSource, creativityMix + roundEcho);
  return snapToRenderPalette(mixed, renderPalette);
}

export function artPhaseForRound(round: number, rounds: number): ReplayRound["art_phase"] {
  const progress = round / Math.max(1, rounds);
  if (progress <= 0.24) {
    return {
      id: "block_in",
      label: "Block In",
      focus: "先立主像大形和中心占位"
    };
  }
  if (progress <= 0.48) {
    return {
      id: "silhouette",
      label: "Silhouette",
      focus: "强化主像轮廓和结构边界"
    };
  }
  if (progress <= 0.68) {
    return {
      id: "motif",
      label: "Motif",
      focus: "补主像内部符号与节奏"
    };
  }
  if (progress <= 0.88) {
    return {
      id: "background",
      label: "Background",
      focus: "扩展背景叙事和陪衬层次"
    };
  }
  return {
    id: "resolve",
    label: "Resolve",
    focus: "整体收束、补空白、统一色群"
  };
}

export function phaseGateAt({
  x,
  y,
  phase,
  artDirection,
  width,
  height
}: {
  x: number;
  y: number;
  phase: ReplayRound["art_phase"];
  artDirection: ArtDirection;
  width: number;
  height: number;
}): number {
  const core = artDirection.zone_guides.find((zone) => zone.kind === "center_halo");
  const diagonal = artDirection.zone_guides.find((zone) => zone.kind === "diagonal_rift");
  const horizon = artDirection.zone_guides.find((zone) => zone.kind === "horizon_band");
  const corners = artDirection.zone_guides.find((zone) => zone.kind === "corner_sigils");
  const spiral = artDirection.zone_guides.find((zone) => zone.kind === "spiral");

  const coreArea = core ? zoneWeight(width, height, core, x, y) : 0;
  const coreMotif = core ? motifMask({ width, height, motif: core.motif, zone: core, x, y }) : 0;
  const coreOutline = core ? motifOutlineStrength({ width, height, motif: core.motif, zone: core, x, y }) : 0;
  const diagonalArea = diagonal ? zoneWeight(width, height, diagonal, x, y) : 0;
  const horizonArea = horizon ? zoneWeight(width, height, horizon, x, y) : 0;
  const spiralArea = spiral ? zoneWeight(width, height, spiral, x, y) : 0;
  const cornerArea = corners ? zoneWeight(width, height, corners, x, y) : 0;

  if (phase.id === "block_in") {
    return clamp(coreMotif * 2.2 + coreArea * 0.9 + diagonalArea * 0.25, 0, 1);
  }

  if (phase.id === "silhouette") {
    return clamp(coreOutline * 2.4 + coreMotif * 0.6 + diagonalArea * 0.35, 0, 1);
  }

  if (phase.id === "motif") {
    return clamp(coreMotif * 1.4 + spiralArea * 0.7 + horizonArea * 0.35, 0, 1);
  }

  if (phase.id === "background") {
    const background = horizonArea * 0.9 + diagonalArea * 0.8 + cornerArea * 0.6 + spiralArea * 0.4;
    return clamp(background + (1 - coreArea) * 0.25, 0, 1);
  }

  return 1;
}

export function targetPriorityAt({
  x,
  y,
  phase,
  artDirection,
  width,
  height
}: {
  x: number;
  y: number;
  phase: ReplayRound["art_phase"];
  artDirection: ArtDirection;
  width: number;
  height: number;
}): number {
  const core = artDirection.zone_guides.find((zone) => zone.kind === "center_halo");
  const diagonal = artDirection.zone_guides.find((zone) => zone.kind === "diagonal_rift");
  const horizon = artDirection.zone_guides.find((zone) => zone.kind === "horizon_band");
  const corners = artDirection.zone_guides.find((zone) => zone.kind === "corner_sigils");
  const spiral = artDirection.zone_guides.find((zone) => zone.kind === "spiral");

  const zoneScore = (zone: ArtZone | undefined): number => {
    if (!zone) return 0;
    return zoneWeight(width, height, zone, x, y) * zone.emphasis;
  };

  const motifScore = (zone: ArtZone | undefined): number => {
    if (!zone) return 0;
    return motifMask({ width, height, motif: zone.motif, zone, x, y }) * zone.emphasis;
  };

  const outlineScore = (zone: ArtZone | undefined): number => {
    if (!zone) return 0;
    return motifOutlineStrength({ width, height, motif: zone.motif, zone, x, y }) * zone.emphasis * 1.5;
  };

  const backgroundPresence =
    zoneScore(horizon) * 0.8 +
    zoneScore(diagonal) * 0.7 +
    zoneScore(corners) * 0.6 +
    zoneScore(spiral) * 0.45;

  let score = 0;
  if (phase.id === "block_in") {
    score = motifScore(core) * 2.8 + outlineScore(core) * 2.2 + zoneScore(core) * 1.6 + zoneScore(diagonal) * 0.7;
  } else if (phase.id === "silhouette") {
    score = outlineScore(core) * 2.6 + motifScore(core) * 1.7 + outlineScore(diagonal) * 1.2 + zoneScore(diagonal) * 0.8;
  } else if (phase.id === "motif") {
    score = motifScore(core) * 1.8 + motifScore(spiral) * 1.2 + motifScore(horizon) * 1.1 + zoneScore(core) * 0.9;
  } else if (phase.id === "background") {
    score = backgroundPresence * 1.45 + zoneScore(core) * 0.25;
  } else {
    score = motifScore(core) * 0.8 + outlineScore(core) * 0.8 + backgroundPresence * 0.9 + zoneScore(core) * 0.5;
  }

  return score * (0.35 + phaseGateAt({ x, y, phase, artDirection, width, height }) * 0.65);
}
