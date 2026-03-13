import { useCallback, useEffect, useState } from "react";
import type { ReplayData, ReplayListItem, Frame, HydratedReplay } from "../types";
import {
  REPLAY_POLL_MS,
  actionStepsForRound,
  stableColorMap,
  buildAgentDirectory,
  buildFrames,
  fetchJSON,
  normalizedSchemaVersion,
  schemaWarningFor
} from "../utils";

export function useReplayData() {
  const [replays, setReplays] = useState<ReplayListItem[]>([]);
  const [currentReplay, setCurrentReplay] = useState<HydratedReplay | null>(null);
  const [currentReplayName, setCurrentReplayName] = useState("");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [followLatest, setFollowLatest] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [schemaWarning, setSchemaWarning] = useState("");
  const [filterMode, setFilterMode] = useState<"" | "dry-run" | "live">("");
  const [filterAgentsMin, setFilterAgentsMin] = useState("");

  const loadReplay = useCallback(
    async (
      name: string,
      options?: { autoPlay?: boolean; hint?: string }
    ): Promise<{
      hydrated: HydratedReplay;
      builtFrames: Frame[];
      shouldAutoPlay: boolean;
      initialStepCount: number;
      hint: string;
      warning: string;
    }> => {
      const data = await fetchJSON<ReplayData>(`/api/replay/${encodeURIComponent(name)}`);
      const schemaVersion = normalizedSchemaVersion(data.schema_version);
      const normalizedData: ReplayData = {
        ...data,
        schema_version: schemaVersion
      };
      const hydrated: HydratedReplay = {
        ...normalizedData,
        colorMap: stableColorMap(normalizedData),
        agentDirectory: buildAgentDirectory(normalizedData)
      };
      const builtFrames = buildFrames(normalizedData);
      const shouldAutoPlay = options?.autoPlay ?? true;
      const initialSteps = actionStepsForRound(builtFrames[0]?.source);
      const warning = schemaWarningFor(schemaVersion);

      setCurrentReplayName(name);
      setCurrentReplay(hydrated);
      setFrames(builtFrames);
      setErrorText("");
      setSchemaWarning(warning);

      return {
        hydrated,
        builtFrames,
        shouldAutoPlay,
        initialStepCount: shouldAutoPlay ? 0 : initialSteps.length,
        hint: options?.hint ?? "",
        warning
      };
    },
    []
  );

  const loadReplayList = useCallback(
    async (options?: { autoSwitchLatest?: boolean; preserveSelection?: boolean; silent?: boolean }) => {
      if (loadingList) return;
      setLoadingList(true);
      try {
        const params = new URLSearchParams();
        if (filterMode) params.set("mode", filterMode);
        if (filterAgentsMin) params.set("agents_min", filterAgentsMin);
        const qs = params.toString();
        const data = await fetchJSON<{ replays: ReplayListItem[] }>(`/api/replays${qs ? `?${qs}` : ""}`);
        const incoming = data.replays || [];
        setReplays(incoming);

        if (incoming.length === 0) {
          setSchemaWarning("");
          setErrorText("output 目录没有 replay 文件，先运行一局模拟。");
          return null;
        }

        const newest = incoming[0]?.name ?? "";
        const previousReplay = currentReplayName;
        const preserveSelection = options?.preserveSelection ?? true;
        const autoSwitchLatest = options?.autoSwitchLatest ?? true;

        let target = newest;
        if (!followLatest && preserveSelection && previousReplay && incoming.some((item) => item.name === previousReplay)) {
          target = previousReplay;
        }
        if (followLatest && autoSwitchLatest) {
          target = newest;
        }

        if (!currentReplay || target !== previousReplay) {
          const switchedByLatest = Boolean(previousReplay) && target === newest && target !== previousReplay && followLatest;
          return await loadReplay(target, {
            autoPlay: true,
            hint: switchedByLatest ? "检测到新 replay，已自动切换" : options?.silent ? "" : ""
          });
        }
        return null;
      } catch (error) {
        setSchemaWarning("");
        setErrorText(error instanceof Error ? error.message : String(error));
        return null;
      } finally {
        setLoadingList(false);
      }
    },
    [currentReplay, currentReplayName, filterMode, filterAgentsMin, followLatest, loadReplay, loadingList]
  );

  useEffect(() => {
    loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: false }).catch(() => undefined);
  }, [loadReplayList]);

  useEffect(() => {
    if (!followLatest) return undefined;
    const handle = window.setInterval(() => {
      loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: true }).catch(() => undefined);
    }, REPLAY_POLL_MS);
    return () => window.clearInterval(handle);
  }, [followLatest, loadReplayList]);

  return {
    replays,
    currentReplay,
    currentReplayName,
    frames,
    followLatest,
    setFollowLatest,
    loadingList,
    errorText,
    schemaWarning,
    loadReplay,
    loadReplayList,
    filterMode,
    setFilterMode,
    filterAgentsMin,
    setFilterAgentsMin
  };
}
