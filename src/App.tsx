import { useState } from "react";
import { ControlHeader } from "./components/ControlHeader";
import { IntegrationRail } from "./components/IntegrationRail";
import { ReviewBoard } from "./components/ReviewBoard";
import { StageSidebar } from "./components/StageSidebar";
import { StageWorkspace } from "./components/StageWorkspace";
import { SurfaceGrid } from "./components/SurfaceGrid";
import {
  integrationDocs,
  integrationSteps,
  operatorCommands,
  productSurfaces,
  reviewLanes,
  stages,
  summaryStats,
} from "./data";
import { useGatewayOverview } from "./openclaw/useGatewayOverview";

function App() {
  const [activeStageId, setActiveStageId] = useState(stages[0]?.id ?? "act-1");
  const activeStage = stages.find((stage) => stage.id === activeStageId) ?? stages[0];
  const gateway = useGatewayOverview();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#eef1f6_100%)] text-slate-950">
      <ControlHeader />

      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-6 xl:grid-cols-[18rem,minmax(0,1fr),24rem]">
          <StageSidebar
            stages={stages}
            activeStageId={activeStageId}
            onSelectStage={setActiveStageId}
          />
          <StageWorkspace stage={activeStage} summaryStats={summaryStats} />
          <IntegrationRail
            docs={integrationDocs}
            steps={integrationSteps}
            commands={operatorCommands}
            gateway={gateway}
          />
        </section>

        <SurfaceGrid surfaces={productSurfaces} />
        <ReviewBoard reviewLanes={reviewLanes} />
      </main>
    </div>
  );
}

export default App;
