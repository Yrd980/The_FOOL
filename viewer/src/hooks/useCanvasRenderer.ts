import { useEffect, useRef } from "react";
import type { Frame, HydratedReplay, ReplayActionStep } from "../types";

export function useCanvasRenderer(
  currentReplay: HydratedReplay | null,
  frame: Frame | null,
  previousFrame: Frame | null,
  currentActionSteps: ReplayActionStep[],
  revealedStepCount: number,
  activePlaybackStep: ReplayActionStep | null,
  revealedStepUpdateCount: number
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!currentReplay || !frame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const cellW = canvas.width / currentReplay.config.width;
    const cellH = canvas.height / currentReplay.config.height;

    context.fillStyle = "#111";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < currentReplay.config.height; y += 1) {
      for (let x = 0; x < currentReplay.config.width; x += 1) {
        const cell = previousFrame?.board[y]?.[x];
        if (!cell?.owner) continue;
        context.fillStyle = cell.color;
        context.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    for (const step of currentActionSteps.slice(0, Math.min(revealedStepCount, currentActionSteps.length))) {
      for (const update of step.updates) {
        const px = Math.floor(update.x * cellW);
        const py = Math.floor(update.y * cellH);
        const pw = Math.ceil(cellW);
        const ph = Math.ceil(cellH);

        if (!update.owner) {
          context.fillStyle = "#111";
          context.fillRect(px, py, pw, ph);
          continue;
        }

        context.fillStyle = update.color;
        context.fillRect(px, py, pw, ph);
      }
    }

    for (const update of activePlaybackStep?.updates.slice(0, revealedStepUpdateCount) ?? []) {
      const px = Math.floor(update.x * cellW);
      const py = Math.floor(update.y * cellH);
      const pw = Math.ceil(cellW);
      const ph = Math.ceil(cellH);

      if (!update.owner) {
        context.fillStyle = "#111";
        context.fillRect(px, py, pw, ph);
        continue;
      }

      context.fillStyle = update.color;
      context.fillRect(px, py, pw, ph);
    }

    context.strokeStyle = "rgba(255,255,255,0.03)";
    context.lineWidth = 1;
    for (let x = 0; x <= currentReplay.config.width; x += Math.max(1, Math.round(currentReplay.config.width / 16))) {
      const px = x * cellW;
      context.beginPath();
      context.moveTo(px, 0);
      context.lineTo(px, canvas.height);
      context.stroke();
    }
  }, [activePlaybackStep, currentActionSteps, currentReplay, frame, previousFrame, revealedStepCount, revealedStepUpdateCount]);

  return { canvasRef };
}
