import type { ArtDirection, ArtZone } from "../types";
import { ART_PALETTE_LIBRARY, MOTIF_LIBRARY } from "./constants";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

function uniqueColors(colors: string[]): string[] {
  return [...new Set(colors.filter((color) => /^#[0-9A-Fa-f]{6}$/.test(color)))];
}

function neighbors4(x: number, y: number, width: number, height: number): Array<{ x: number; y: number }> {
  const list = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ];
  return list.filter((point) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height);
}

function zoneWeight(width: number, height: number, zone: ArtZone, x: number, y: number): number {
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

function motifMask(width: number, height: number, motif: string, zone: ArtZone, x: number, y: number): number {
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

function motifOutlineStrength(width: number, height: number, motif: string, zone: ArtZone, x: number, y: number): number {
  const center = motifMask(width, height, motif, zone, x, y);
  let edge = 0;
  for (const neighbor of neighbors4(x, y, width, height)) {
    const around = motifMask(width, height, motif, zone, neighbor.x, neighbor.y);
    edge = Math.max(edge, Math.abs(center - around));
  }
  return clamp(edge, 0, 1);
}

function paletteGradientColor(palette: string[], tone: number, fallbackPalette: string[]): string {
  if (palette.length === 0) {
    return fallbackPalette[0] ?? "#E7D7C1";
  }
  if (palette.length === 1) {
    return palette[0];
  }

  const scaled = clamp(tone, 0, 1) * (palette.length - 1);
  const leftIndex = Math.floor(scaled);
  const rightIndex = Math.min(palette.length - 1, leftIndex + 1);
  const blend = scaled - leftIndex;
  return blendHexColors(palette[leftIndex], palette[rightIndex], blend);
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

function applyLayerMask(
  field: string[][],
  width: number,
  height: number,
  zone: ArtZone,
  motif: string,
  fillColor: string,
  opacityScale: number,
  minMask = 0.03
): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mask = motifMask(width, height, motif, zone, x, y);
      if (mask < minMask) continue;
      field[y][x] = blendHexColors(field[y][x], fillColor, clamp(mask * opacityScale, 0.08, 0.9));
    }
  }
}

function applyOutlineLayer(field: string[][], width: number, height: number, zone: ArtZone, motif: string, outlineColor: string): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mask = motifMask(width, height, motif, zone, x, y);
      const edge = motifOutlineStrength(width, height, motif, zone, x, y);
      if (mask < 0.08 || edge < 0.18) continue;
      field[y][x] = blendHexColors(field[y][x], outlineColor, clamp(edge * 0.95, 0.18, 0.82));
    }
  }
}

function applyHaloLayer(field: string[][], width: number, height: number, zone: ArtZone, haloColor: string, strength: number): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const weight = zoneWeight(width, height, zone, x, y) * (zone.emphasis / 100);
      if (weight < 0.04) continue;
      field[y][x] = blendHexColors(field[y][x], haloColor, clamp(weight * strength, 0.04, 0.38));
    }
  }
}

export function buildArtDirection(themePrompt: string): ArtDirection {
  const lower = themePrompt.toLowerCase();
  const seed = hashText(themePrompt);
  const paletteKit =
    ART_PALETTE_LIBRARY.find((item) =>
      item.moods.some((mood) => lower.includes(mood)) ||
      (item.name === "Solar Relic" && (lower.includes("crown") || lower.includes("throne") || lower.includes("king"))) ||
      (item.name === "Moon Archive" && (lower.includes("moon") || lower.includes("dream") || lower.includes("night"))) ||
      (item.name === "Ritual Rust" && (lower.includes("machine") || lower.includes("rust") || lower.includes("ruin"))) ||
      (item.name === "Verdict Bloom" && (lower.includes("garden") || lower.includes("flower") || lower.includes("choir"))) ||
      (item.name === "Ashen Choir" && (lower.includes("storm") || lower.includes("tide") || lower.includes("shrine")))
    ) ?? ART_PALETTE_LIBRARY[seed % ART_PALETTE_LIBRARY.length];

  const palette = [...paletteKit.colors];
  const motifs = [...new Set(MOTIF_LIBRARY.filter((motif) => lower.includes(motif)).concat(shuffled(MOTIF_LIBRARY).slice(0, 3)))].slice(0, 5);
  const titleLead = motifs[0] ? `${motifs[0][0].toUpperCase()}${motifs[0].slice(1)}` : "Myth";

  const zoneGuides: ArtZone[] = [
    {
      id: "core-halo",
      label: "Core Halo",
      kind: "center_halo",
      motif: motifs[0] ?? "crown",
      preferred_palette: palette.slice(2, 5),
      emphasis: 92,
      offset: ((seed % 17) - 8) / 100,
      radius: 0.26,
      note: "中心应该有召唤感或圣像感，允许更亮、更庄严。"
    },
    {
      id: "diagonal-rift",
      label: "Diagonal Rift",
      kind: "diagonal_rift",
      motif: motifs[1] ?? "rift",
      preferred_palette: [palette[0], palette[1], palette[3]],
      emphasis: 74,
      offset: ((seed % 29) - 14) / 100,
      radius: 0.12,
      note: "斜向张力带，适合冲突、裂痕、旗帜或攻势。"
    },
    {
      id: "horizon-band",
      label: "Horizon Band",
      kind: "horizon_band",
      motif: motifs[2] ?? "banner",
      preferred_palette: [palette[1], palette[2], palette[4]],
      emphasis: 68,
      offset: 0.52 + ((seed % 11) - 5) / 100,
      radius: 0.14,
      note: "水平叙事带，适合秩序、仪式、协商和结构。"
    },
    {
      id: "corner-sigils",
      label: "Corner Sigils",
      kind: "corner_sigils",
      motif: motifs[3] ?? "sigil",
      preferred_palette: [palette[0], palette[4]],
      emphasis: 34,
      offset: 0,
      radius: 0.11,
      note: "角落是副叙事与签名区域，适合留下象征。"
    },
    {
      id: "spiral-echo",
      label: "Spiral Echo",
      kind: "spiral",
      motif: motifs[4] ?? "spiral",
      preferred_palette: [palette[2], palette[3], palette[4]],
      emphasis: 61,
      offset: (seed % 360) / 360,
      radius: 0.32,
      note: "允许局部重复、回声与梦境式旋涡。"
    }
  ];

  return {
    mode: "myth",
    theme_prompt: themePrompt,
    title: `${paletteKit.name} ${titleLead} Myth`,
    mood_words: paletteKit.moods,
    palette,
    forbidden_colors: paletteKit.forbidden,
    motifs,
    composition_notes: [
      "中心必须有主意象，不要整张图平均化。",
      "保留 10%-18% 的安静区，不要把每个区域都填得同样吵。",
      "让高张力区域沿一条斜向或环形轨迹传播。",
      "重复 motif 时要像仪式回声，不要像机械复制。"
    ],
    zone_guides: zoneGuides
  };
}

export function buildRenderPalette(artDirection: ArtDirection): string[] {
  const base = artDirection.palette;
  const derived = [
    ...base,
    ...base.slice(0, -1).map((color, index) => blendHexColors(color, base[index + 1], 0.5)),
    blendHexColors(base[0], base[base.length - 1], 0.25),
    blendHexColors(base[0], base[base.length - 1], 0.75),
    blendHexColors(base[1] ?? base[0], base[3] ?? base[base.length - 1], 0.5)
  ];
  return uniqueColors(derived).slice(0, 14);
}

export function buildArtTarget({
  width,
  height,
  artDirection,
  renderPalette
}: {
  width: number;
  height: number;
  artDirection: ArtDirection;
  renderPalette: string[];
}): string[][] {
  const dark = artDirection.palette[0] ?? "#22181C";
  const deep = artDirection.palette[1] ?? dark;
  const mid = artDirection.palette[2] ?? deep;
  const light = artDirection.palette[3] ?? mid;
  const accent = artDirection.palette[4] ?? light;
  const field = Array.from({ length: height }, () => Array<string>(width).fill(dark));
  const core = artDirection.zone_guides.find((zone) => zone.kind === "center_halo") ?? artDirection.zone_guides[0];
  const diagonal = artDirection.zone_guides.find((zone) => zone.kind === "diagonal_rift") ?? artDirection.zone_guides[1] ?? core;
  const horizon = artDirection.zone_guides.find((zone) => zone.kind === "horizon_band") ?? artDirection.zone_guides[2] ?? core;
  const corners = artDirection.zone_guides.find((zone) => zone.kind === "corner_sigils") ?? artDirection.zone_guides[3] ?? core;
  const spiral = artDirection.zone_guides.find((zone) => zone.kind === "spiral") ?? artDirection.zone_guides[4] ?? core;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const baseTone = clamp(0.12 + ny * 0.42 + Math.sin(nx * Math.PI * 1.4) * 0.05, 0, 1);
      field[y][x] = paletteGradientColor([dark, deep, mid, light], baseTone, artDirection.palette);
    }
  }

  applyHaloLayer(field, width, height, core, blendHexColors(light, accent, 0.35), 0.55);
  applyHaloLayer(field, width, height, spiral, blendHexColors(mid, accent, 0.25), 0.24);
  applyHaloLayer(field, width, height, diagonal, blendHexColors(dark, deep, 0.4), 0.28);

  if (core) {
    applyLayerMask(field, width, height, core, core.motif, blendHexColors(dark, mid, 0.25), 0.88, 0.06);
    applyOutlineLayer(field, width, height, core, core.motif, dark);
  }

  if (horizon) {
    applyLayerMask(field, width, height, horizon, horizon.motif, blendHexColors(light, accent, 0.18), 0.42, 0.08);
  }

  if (diagonal) {
    applyLayerMask(field, width, height, diagonal, diagonal.motif, blendHexColors(deep, dark, 0.2), 0.56, 0.07);
  }

  if (spiral) {
    applyLayerMask(field, width, height, spiral, spiral.motif, blendHexColors(mid, light, 0.3), 0.28, 0.1);
  }

  if (corners) {
    applyLayerMask(field, width, height, corners, corners.motif, accent, 0.2, 0.18);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const halo = core ? zoneWeight(width, height, core, x, y) : 0;
      const diagonalWeight = diagonal ? zoneWeight(width, height, diagonal, x, y) : 0;
      const horizonWeight = horizon ? zoneWeight(width, height, horizon, x, y) : 0;
      const quietMask = Math.max(0, 1 - halo * 1.1 - diagonalWeight * 0.8 - horizonWeight * 0.5);
      if (quietMask > 0.72) {
        field[y][x] = blendHexColors(field[y][x], light, 0.12);
      }
      field[y][x] = snapToRenderPalette(field[y][x], renderPalette);
    }
  }

  return field;
}
