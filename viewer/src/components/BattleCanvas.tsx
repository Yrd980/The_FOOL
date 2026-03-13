import type { RefObject } from "react";
import type { Frame, ReplayActionStep } from "../types";
import { actionStepsForRound } from "../utils";

export function BattleCanvas({
  canvasRef,
  frame,
  frames,
  roundIndex,
  setRoundIndex,
  revealedStepCount,
  setRevealedStepCount,
  setRevealedStepUpdateCount,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
  followLatest,
  setFollowLatest,
  loop,
  setLoop,
  currentActionSteps,
  visibleStepCount,
  totalActionSteps,
  revealedUpdateCount,
  totalStepUpdates,
  revealPercent,
  activeStepLabel
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  frame: Frame | null;
  frames: Frame[];
  roundIndex: number;
  setRoundIndex: (index: number) => void;
  revealedStepCount: number;
  setRevealedStepCount: (count: number) => void;
  setRevealedStepUpdateCount: (count: number) => void;
  isPlaying: boolean;
  setIsPlaying: (value: boolean | ((current: boolean) => boolean)) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  followLatest: boolean;
  setFollowLatest: (value: boolean) => void;
  loop: boolean;
  setLoop: (value: boolean) => void;
  currentActionSteps: ReplayActionStep[];
  visibleStepCount: number;
  totalActionSteps: number;
  revealedUpdateCount: number;
  totalStepUpdates: number;
  revealPercent: number;
  activeStepLabel: string;
}) {
  return (
    <article className="flex min-h-0 flex-1 flex-col rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-3 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      {/* Status bar */}
      <div className="mb-2 flex items-center gap-2 font-mono text-xs text-[#5b6a71]">
        <span className="rounded-full bg-[#13232f] px-2.5 py-0.5 text-[#f3f8fb]">
          R{frame?.round ?? 0}/{frames.length}
        </span>
        <span>S {visibleStepCount}/{totalActionSteps || 0} · P {revealedUpdateCount}/{totalStepUpdates || 0} · {revealPercent}%</span>
        <span className="ml-auto truncate text-[#5b6a71]/70">{activeStepLabel}</span>
      </div>

      {/* Canvas — fills available space */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={768}
          height={768}
          aria-label="battle canvas"
          className="h-full max-h-full w-auto rounded-2xl border border-[#c8bda5] bg-[#111] shadow-inner"
          style={{ aspectRatio: "1/1", objectFit: "contain" }}
        />
      </div>

      {/* Controls — compact single row */}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-[#5b6a71]">
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            const nextIndex = Math.max(0, roundIndex - 1);
            setRoundIndex(nextIndex);
            setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
            setRevealedStepUpdateCount(0);
          }}
          className="rounded-lg border border-[#dbcfb4] bg-white/70 px-2.5 py-1 text-[#13232f] transition hover:bg-white"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={() =>
            setIsPlaying((current: boolean) => {
              if (!current && revealedStepCount >= currentActionSteps.length) {
                setRevealedStepCount(0);
                setRevealedStepUpdateCount(0);
              }
              if (current) return false;
              return true;
            })
          }
          className="rounded-lg bg-gradient-to-br from-[#db5b3f] to-[#ec7d56] px-3 py-1 text-white transition hover:brightness-110"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            const nextIndex = Math.min(frames.length - 1, roundIndex + 1);
            setRoundIndex(nextIndex);
            setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
            setRevealedStepUpdateCount(0);
          }}
          className="rounded-lg border border-[#dbcfb4] bg-white/70 px-2.5 py-1 text-[#13232f] transition hover:bg-white"
        >
          ▶
        </button>
        <input
          className="mx-1 min-w-0 flex-1"
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={roundIndex}
          onChange={(event) => {
            setIsPlaying(false);
            const nextIndex = Number(event.target.value);
            setRoundIndex(nextIndex);
            setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
            setRevealedStepUpdateCount(0);
          }}
        />
        <label className="flex items-center gap-1" title="跟随最新">
          <input type="checkbox" checked={followLatest} onChange={(event) => setFollowLatest(event.target.checked)} />
          跟随
        </label>
        <label className="flex items-center gap-1" title="循环播放">
          <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
          循环
        </label>
        <input className="w-16" type="range" min="300" max="1800" step="100" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} title="速度" />
      </div>
    </article>
  );
}
