import { useEffect, useState } from "react";
import {
  audienceHandles,
  contestantOpenClawPresences,
  contestants,
  danmuTemplates,
  openClawConversation,
  seedAudienceInteractions,
} from "../data";
import type { AudienceInteraction, ContestantOpenClawPresence, OpenClawConversation } from "../types";
import { appendSeedInteraction } from "./seedRoomSource";

export interface SeedRoomSource {
  interactions: AudienceInteraction[];
  openClawConversation: OpenClawConversation;
  contestantOpenClawPresences: ContestantOpenClawPresence[];
}

export const useSeedRoomSource = (): SeedRoomSource => {
  const [interactions, setInteractions] = useState<AudienceInteraction[]>(seedAudienceInteractions);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setInteractions((current) =>
        appendSeedInteraction({ current, contestants, audienceHandles, danmuTemplates }),
      );
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  return { interactions, openClawConversation, contestantOpenClawPresences };
};
