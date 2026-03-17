import { useEffect, useState } from "react";
import { ControlHeader } from "./components/ControlHeader";
import { ControlMode } from "./components/ControlMode";
import { ShowMode } from "./components/ShowMode";
import {
  integrationDocs,
  operatorCommands,
  stageRuntimeGuides,
  stages,
  summaryStats,
} from "./data";
import { useGatewayOverview } from "./openclaw/useGatewayOverview";

type AppMode = "control" | "show";

const getModeFromPath = (): AppMode => {
  if (typeof window === "undefined") {
    return "show";
  }

  return window.location.pathname.startsWith("/control") ? "control" : "show";
};

function App() {
  const [mode, setMode] = useState<AppMode>(getModeFromPath);
  const [activeStageId, setActiveStageId] = useState(stages[0]?.id ?? "act-1");
  const activeStage = stages.find((stage) => stage.id === activeStageId) ?? stages[0];
  const gateway = useGatewayOverview();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/show");
    }

    const handlePopState = () => {
      setMode(getModeFromPath());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleModeChange = (nextMode: AppMode) => {
    if (typeof window !== "undefined") {
      const nextPath = nextMode === "control" ? "/control" : "/show";
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
    }

    setMode(nextMode);
  };

  return (
    <div
      className={`min-h-screen ${
        mode === "show"
          ? "bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_20%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.16),transparent_18%),linear-gradient(180deg,#050816_0%,#0b1020_54%,#0f172a_100%)]"
          : "bg-[linear-gradient(180deg,#f7f8fb_0%,#eef1f6_100%)] text-slate-950"
      }`}
    >
      <ControlHeader
        mode={mode}
        onSelectMode={handleModeChange}
        activeStage={activeStage}
        gateway={gateway}
      />

      {mode === "show" ? (
        <ShowMode
          stage={activeStage}
          stages={stages}
          runtimeGuide={stageRuntimeGuides[activeStage.id]}
          gateway={gateway}
        />
      ) : (
        <ControlMode
          stage={activeStage}
          stages={stages}
          activeStageId={activeStageId}
          onSelectStage={setActiveStageId}
          runtimeGuide={stageRuntimeGuides[activeStage.id]}
          gateway={gateway}
          summaryStats={summaryStats}
          docs={integrationDocs}
          commands={operatorCommands}
        />
      )}
    </div>
  );
}

export default App;
