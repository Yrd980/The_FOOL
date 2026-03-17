import type { TownBuildingTheme } from "./room/townLayout";

export const rootBackdropClass =
  "[background:linear-gradient(180deg,rgba(255,250,246,0.68),rgba(239,227,216,0.92)),repeating-linear-gradient(90deg,rgba(255,255,255,0)_0,rgba(255,255,255,0)_74px,rgba(134,56,50,0.05)_74px,rgba(134,56,50,0.05)_75px),radial-gradient(circle_at_top_right,rgba(200,29,24,0.1),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(200,29,24,0.07),transparent_26%)]";

export const shellCrossClass =
  "[background:linear-gradient(45deg,transparent_36%,rgba(200,29,24,0.08)_36%,rgba(200,29,24,0.08)_43%,transparent_43%),linear-gradient(-45deg,transparent_36%,rgba(200,29,24,0.08)_36%,rgba(200,29,24,0.08)_43%,transparent_43%)]";

export const sideRailClass =
  "bg-[linear-gradient(180deg,rgba(200,29,24,0.9),rgba(141,14,18,0.72))]";

export const panelCanvasClass =
  "[background:radial-gradient(circle_at_top_left,rgba(255,255,255,0.62),transparent_34%),linear-gradient(180deg,rgba(255,252,248,0.9),rgba(245,236,227,0.92)),linear-gradient(rgba(117,39,36,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(117,39,36,0.18)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px]";

export const roomCanvasClass =
  "[background:radial-gradient(circle_at_top_left,rgba(255,255,255,0.56),transparent_30%),linear-gradient(180deg,rgba(255,252,248,0.92),rgba(244,236,227,0.95)),linear-gradient(rgba(117,39,36,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(117,39,36,0.18)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px]";

export const mapCrossClass =
  "[background:linear-gradient(44deg,transparent_38%,rgba(200,29,24,0.84)_38%,rgba(200,29,24,0.84)_46%,transparent_46%),linear-gradient(-39deg,transparent_41%,rgba(200,29,24,0.88)_41%,rgba(200,29,24,0.88)_49%,transparent_49%)]";

export const mapVignetteClass =
  "[background:linear-gradient(180deg,rgba(255,255,255,0.18),transparent_16%,transparent_84%,rgba(18,12,13,0.16)),radial-gradient(circle_at_center,transparent_54%,rgba(18,12,13,0.24)_100%)]";

export const roomCrossClass =
  "[background:linear-gradient(45deg,transparent_38%,rgba(200,29,24,0.9)_38%,rgba(200,29,24,0.9)_46%,transparent_46%),linear-gradient(-39deg,transparent_41%,rgba(200,29,24,0.92)_41%,rgba(200,29,24,0.92)_49%,transparent_49%)]";

export const roomVignetteClass =
  "[background:radial-gradient(circle_at_center,transparent_58%,rgba(18,12,13,0.14)_100%),linear-gradient(180deg,rgba(255,255,255,0.14),transparent_20%,transparent_82%,rgba(18,12,13,0.08))]";

const buildingThemeClassMap: Record<TownBuildingTheme, string> = {
  lobby: "bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,237,227,0.88))]",
  "print-shop": "bg-[linear-gradient(180deg,rgba(255,249,245,0.92),rgba(239,229,219,0.88))]",
  clinic: "bg-[linear-gradient(180deg,rgba(251,252,255,0.94),rgba(230,236,241,0.9))]",
  convenience: "bg-[linear-gradient(180deg,rgba(255,250,244,0.94),rgba(237,228,219,0.88))]",
  "quiet-zone": "bg-[linear-gradient(180deg,rgba(196,200,194,0.78),rgba(135,143,135,0.7))]",
};

export const roomTintClassMap: Record<TownBuildingTheme, string> = {
  lobby: "bg-[rgba(200,29,24,0.06)]",
  "print-shop": "bg-[rgba(205,105,62,0.08)]",
  clinic: "bg-[rgba(103,140,172,0.08)]",
  convenience: "bg-[rgba(184,126,71,0.08)]",
  "quiet-zone": "bg-[rgba(95,108,103,0.1)]",
};

export function buildingThemeClass(theme: TownBuildingTheme) {
  return buildingThemeClassMap[theme];
}
