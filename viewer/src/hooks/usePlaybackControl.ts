import { useEffect, useMemo, useState } from "react";
import type { Frame, HydratedReplay, ReplayActionStep } from "../types";
import {
  REPLAY_POLL_MS,
  DEFAULT_SPEED,
  MIN_REVEAL_TICK_MS,
  actionStepsForRound,
  revealChunkSize
} from "../utils";

export function usePlaybackControl(
  frames: Frame[],
  followLatest: boolean,
  _currentReplay: HydratedReplay | null
) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [revealedStepCount, setRevealedStepCount] = useState(0);
  const [revealedStepUpdateCount, setRevealedStepUpdateCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [loop, setLoop] = useState(true);
  const [watchHint, setWatchHint] = useState("");

  const frame = frames[roundIndex] ?? null;
  const previousFrame = roundIndex > 0 ? frames[roundIndex - 1] : null;
  const currentRound = frame?.source ?? null;
  const currentActionSteps: ReplayActionStep[] = useMemo(() => actionStepsForRound(currentRound), [currentRound]);
  const totalStepUpdates = useMemo(
    () => currentActionSteps.reduce((sum, step) => sum + step.updates.length, 0),
    [currentActionSteps]
  );
  const revealedUpdateCount = useMemo(() => {
    let total = 0;
    for (let i = 0; i < Math.min(revealedStepCount, currentActionSteps.length); i += 1) {
      total += currentActionSteps[i].updates.length;
    }
    if (revealedStepCount < currentActionSteps.length) {
      total += Math.min(revealedStepUpdateCount, currentActionSteps[revealedStepCount].updates.length);
    }
    return total;
  }, [currentActionSteps, revealedStepCount, revealedStepUpdateCount]);
  const revealPercent = totalStepUpdates > 0 ? Math.round((revealedUpdateCount / totalStepUpdates) * 100) : 100;
  const activePlaybackStep = currentActionSteps[revealedStepCount] ?? null;
  const visibleStepCount = Math.min(
    currentActionSteps.length,
    revealedStepCount + (activePlaybackStep ? 1 : 0)
  );
  const totalActionSteps = currentActionSteps.length;
  const activeStepLabel =
    activePlaybackStep?.label ?? (totalActionSteps > 0 ? currentActionSteps[totalActionSteps - 1]?.label || "Round Complete" : "No Steps");

  useEffect(() => {
    if (!isPlaying || !frame) return undefined;

    const totalUnits = currentActionSteps.reduce((sum, step) => {
      if (step.updates.length === 0) return sum + 1;
      return sum + Math.max(1, Math.ceil(step.updates.length / revealChunkSize(step.updates.length)));
    }, 0);
    const revealTickMs = Math.max(MIN_REVEAL_TICK_MS, Math.round(speed / (Math.max(1, totalUnits) + 2)));
    const holdMs = Math.max(120, speed - revealTickMs * Math.max(1, totalUnits));
    const currentStep = currentActionSteps[revealedStepCount] ?? null;
    const delay = currentStep ? revealTickMs : holdMs;

    const handle = window.setTimeout(() => {
      if (currentStep) {
        const totalUpdates = currentStep.updates.length;
        if (totalUpdates === 0) {
          setRevealedStepCount((current) => Math.min(currentActionSteps.length, current + 1));
          setRevealedStepUpdateCount(0);
          return;
        }

        if (revealedStepUpdateCount < totalUpdates) {
          const chunkSize = revealChunkSize(totalUpdates);
          setRevealedStepUpdateCount((current) => Math.min(totalUpdates, current + chunkSize));
          return;
        }

        setRevealedStepCount((current) => Math.min(currentActionSteps.length, current + 1));
        setRevealedStepUpdateCount(0);
        return;
      }

      if (roundIndex >= frames.length - 1) {
        if (!loop) {
          setIsPlaying(false);
          setRevealedStepCount(currentActionSteps.length);
          setRevealedStepUpdateCount(0);
          return;
        }
        setRoundIndex(0);
        setRevealedStepCount(0);
        setRevealedStepUpdateCount(0);
        return;
      }

      setRoundIndex(roundIndex + 1);
      setRevealedStepCount(0);
      setRevealedStepUpdateCount(0);
    }, delay);

    return () => window.clearTimeout(handle);
  }, [currentActionSteps, frame, frames.length, isPlaying, loop, revealedStepCount, revealedStepUpdateCount, roundIndex, speed]);

  const watchStateText = useMemo(() => {
    const follow = followLatest ? "ON" : "OFF";
    const loopState = loop ? "ON" : "OFF";
    const base = `跟随最新:${follow} | 循环:${loopState} | 轮询:${Math.round(REPLAY_POLL_MS / 1000)}s`;
    return watchHint ? `${base} | ${watchHint}` : base;
  }, [followLatest, loop, watchHint]);

  return {
    roundIndex,
    setRoundIndex,
    revealedStepCount,
    setRevealedStepCount,
    revealedStepUpdateCount,
    setRevealedStepUpdateCount,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    loop,
    setLoop,
    watchHint,
    setWatchHint,
    frame,
    previousFrame,
    currentRound,
    currentActionSteps,
    totalStepUpdates,
    revealedUpdateCount,
    revealPercent,
    activePlaybackStep,
    visibleStepCount,
    totalActionSteps,
    activeStepLabel,
    watchStateText
  };
}
