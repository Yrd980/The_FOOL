import type { AgentState, ArtDirection, ArtZone } from "../types";
import type { CanvasCell } from "./canvasRuntime";

export interface EngineContext {
  board: CanvasCell[][];
  width: number;
  height: number;
  artDirection: ArtDirection;
  artTargetColors: string[][];
  renderPalette: string[];
  mythColorForPoint(
    agent: AgentState,
    x: number,
    y: number,
    requestedColor?: string,
    round?: number
  ): string;
  zoneWeight(zone: ArtZone, x: number, y: number): number;
}
