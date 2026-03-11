import type { AudienceInteraction, AudienceEventType } from "../types";
import type { AppendSeedInteractionInput } from "./types";

const CYCLE_TYPES: AudienceEventType[] = ["bet", "like", "danmaku", "like", "boo", "danmaku"];

export const appendSeedInteraction = ({
  current,
  contestants,
  audienceHandles,
  danmuTemplates,
}: AppendSeedInteractionInput): AudienceInteraction[] => {
  const contestant = contestants[current.length % contestants.length];
  const template = danmuTemplates[current.length % danmuTemplates.length];
  const type = CYCLE_TYPES[current.length % CYCLE_TYPES.length];
  const amount = type === "bet" ? 8 + ((current.length * 3) % 19) : 1;

  return [
    ...current,
    {
      id: `evt-live-${current.length + 1}`,
      contestantId: contestant.id,
      type,
      source: audienceHandles[current.length % audienceHandles.length],
      content:
        type === "bet"
          ? `${contestant.name} 又被房间追加了 ${amount} 点押注。`
          : template.replace("{name}", contestant.name),
      amount,
      timestampLabel: `20:${String(13 + ((current.length + 1) % 45)).padStart(2, "0")}`,
    },
  ];
};
