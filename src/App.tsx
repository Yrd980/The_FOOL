import { useEffect, useState } from "react";
import { ControlHeader } from "./components/ControlHeader";
import { ControlMode } from "./components/ControlMode";
import { ShowMode } from "./components/ShowMode";
import { buildActivityViewModel, buildOperatorCommands } from "./data";
import { tryResolveActivityPackageId } from "./openclaw/activityRuntime";
import { useGatewayOverview } from "./openclaw/useGatewayOverview";

type AppMode = "control" | "show";

interface AppRoute {
  mode: AppMode;
  previewStageId: string | null;
}

const getRouteFromPath = (): AppRoute => {
  if (typeof window === "undefined") {
    return { mode: "show", previewStageId: null };
  }

  const [root, section, stageId] = window.location.pathname
    .split("/")
    .filter(Boolean);

  if (root === "control") {
    return {
      mode: "control",
      previewStageId:
        section === "stages" && stageId ? decodeURIComponent(stageId) : null,
    };
  }

  return {
    mode: "show",
    previewStageId: root === "show" && section ? decodeURIComponent(section) : null,
  };
};

function App() {
  const [route, setRoute] = useState<AppRoute>(getRouteFromPath);
  const gateway = useGatewayOverview();
  const resolvedActivityPackageId = tryResolveActivityPackageId({
    templateId: gateway.activityRun?.templateId,
    previewStageId: route.previewStageId,
  });
  const activity = buildActivityViewModel({
    activityPackageId: resolvedActivityPackageId,
    requestedActivityPackageId: gateway.activityRun?.templateId ?? null,
    fallbackStageId:
      route.previewStageId ?? gateway.authorityStageId ?? gateway.activityRun?.currentStageId,
  });
  const stages = activity.stages;
  const validatedPreviewStageId =
    route.previewStageId &&
    stages.some((stage) => stage.id === route.previewStageId)
      ? route.previewStageId
      : null;
  const validatedAuthorityStageId =
    gateway.authorityStageId &&
    stages.some((stage) => stage.id === gateway.authorityStageId)
      ? gateway.authorityStageId
      : null;
  const activeStageId =
    validatedPreviewStageId ??
    validatedAuthorityStageId ??
    activity.defaultStageId ??
    stages[0]?.id ??
    null;
  const activeStage =
    stages.find((stage) => stage.id === activeStageId) ?? stages[0];
  const activeRuntimeGuide = activeStage
    ? activity.stageRuntimeGuides[activeStage.id]
    : undefined;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/show");
    }

    const handlePopState = () => {
      setRoute(getRouteFromPath());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  if (!activeStage || !activeRuntimeGuide) {
    return null;
  }

  const resolvedActiveStageId = activeStage.id;
  const commands = buildOperatorCommands({
    activity,
    stage: activeStage,
    stages,
    runtimeGuide: activeRuntimeGuide,
    gateway,
  });

  const buildPath = ({
    mode,
    previewStageId,
  }: AppRoute): string => {
    if (previewStageId) {
      return mode === "control"
        ? `/control/stages/${encodeURIComponent(previewStageId)}`
        : `/show/${encodeURIComponent(previewStageId)}`;
    }

    return mode === "control" ? "/control" : "/show";
  };

  const navigate = (nextRoute: AppRoute) => {
    if (typeof window !== "undefined") {
      const nextPath = buildPath(nextRoute);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
    }

    setRoute(nextRoute);
  };

  const handleModeChange = (nextMode: AppMode) => {
    navigate({
      mode: nextMode,
      previewStageId: route.previewStageId,
    });
  };

  const handleStageSelect = (stageId: string) => {
    navigate({
      mode: route.mode,
      previewStageId: stageId,
    });
  };

  return (
    <div
      className={`min-h-screen ${
        route.mode === "show"
          ? "bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_20%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.16),transparent_18%),linear-gradient(180deg,#050816_0%,#0b1020_54%,#0f172a_100%)]"
          : "bg-[linear-gradient(180deg,#f7f8fb_0%,#eef1f6_100%)] text-slate-950"
      }`}
    >
      <ControlHeader
        mode={route.mode}
        onSelectMode={handleModeChange}
        activity={activity}
        activeStage={activeStage}
        gateway={gateway}
      />

      {route.mode === "show" ? (
        <ShowMode
          stage={activeStage}
          stages={stages}
          runtimeGuide={activeRuntimeGuide}
          gateway={gateway}
        />
      ) : (
        <ControlMode
          stage={activeStage}
          stages={stages}
          activeStageId={resolvedActiveStageId}
          authorityStageId={gateway.authorityStageId}
          onSelectStage={handleStageSelect}
          activity={activity}
          runtimeGuide={activeRuntimeGuide}
          gateway={gateway}
          summaryStats={activity.summaryStats}
          docs={activity.integrationDocs}
          commands={commands}
        />
      )}
    </div>
  );
}

export default App;
