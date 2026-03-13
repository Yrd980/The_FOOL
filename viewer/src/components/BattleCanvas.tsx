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
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#13232f]">Battle Canvas</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="rounded-full bg-[#13232f] px-3 py-1 font-mono text-xs text-[#f3f8fb]">
            Round {frame?.round ?? 0} / {frames.length}
          </div>
          <div className="rounded-full border border-[#dbcfb4] bg-white/85 px-3 py-1 font-mono text-xs text-[#5b6a71]">
            Step {visibleStepCount}/{totalActionSteps || 0} · Pixels {revealedUpdateCount}/{totalStepUpdates || 0} · {revealPercent}%
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={768}
        height={768}
        aria-label="battle canvas"
        className="mx-auto w-full max-w-[620px] rounded-2xl border border-[#c8bda5] bg-[#111] shadow-inner"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#5b6a71]">
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            const nextIndex = Math.max(0, roundIndex - 1);
            setRoundIndex(nextIndex);
            setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
            setRevealedStepUpdateCount(0);
          }}
          className="rounded-xl border border-[#dbcfb4] bg-white/70 px-4 py-2 text-[#13232f] shadow-sm transition hover:-translate-y-0.5"
        >
          上一回合
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
          className="rounded-xl bg-gradient-to-br from-[#db5b3f] to-[#ec7d56] px-5 py-2 text-white shadow-sm transition hover:-translate-y-0.5"
        >
          {isPlaying ? "暂停" : "播放"}
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
          className="rounded-xl border border-[#dbcfb4] bg-white/70 px-4 py-2 text-[#13232f] shadow-sm transition hover:-translate-y-0.5"
        >
          下一回合
        </button>

        <label className="rounded-full border border-[#dbcfb4] bg-white/70 px-3 py-1 text-xs text-[#13232f]">
          <input type="checkbox" className="mr-2" checked={followLatest} onChange={(event) => setFollowLatest(event.target.checked)} />
          跟随最新
        </label>
        <label className="rounded-full border border-[#dbcfb4] bg-white/70 px-3 py-1 text-xs text-[#13232f]">
          <input type="checkbox" className="mr-2" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
          循环播放
        </label>

        <label className="ml-auto flex items-center gap-2">
          速度
          <input type="range" min="300" max="1800" step="100" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
      </div>

      <div className="mt-3 rounded-2xl border border-[#dbcfb4] bg-white/70 px-3 py-2 text-xs text-[#5b6a71] shadow-sm">
        当前步骤：{activeStepLabel}
      </div>

      <input
        className="mt-3 w-full"
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
    </article>
  );
}
