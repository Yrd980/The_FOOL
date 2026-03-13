// src/types/entities.ts
import type {
  ContestantOpenClawPresence,
  ContestantScorecard,
  OpenClawContestantState,
} from "../types";

export type SelectionKind = "contestant" | "judge" | "ai" | "listener";

export type SidebarEntity = {
  selectionId: string;
  refId: string;
  kind: SelectionKind;
  group: string;
  name: string;
  subtitle: string;
  status: string;
  badge: string;
  accent: string;
  avatar: string;
  searchable: string;
  x?: number;
  y?: number;
};

export type ContestantSeat = ContestantScorecard &
  ContestantOpenClawPresence & {
    selectionId: string;
    state: OpenClawContestantState;
    stateLabel: string;
    meter: number;
    teamName: string;
    stageNote: string;
    availabilityLabel: string;
    availabilityTone: "available" | "focus" | "busy";
  };

export type DetailCard = {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  chips: string[];
  actions?: Array<{ id: string; label: string; active?: boolean; disabled?: boolean }>;
};

export const buildSelectionId = (kind: SelectionKind, value: string) =>
  `${kind}:${value}`;

export const parseSelectionId = (value: string): [SelectionKind, string] => {
  const separator = value.indexOf(":");
  if (separator === -1) {
    return ["contestant", value];
  }
  return [value.slice(0, separator) as SelectionKind, value.slice(separator + 1)];
};

export const buildAvatar = (value: string) => {
  const compact = value.replace(/\s+/g, "");
  if (compact.length >= 2) {
    return `${compact[0]}${compact[compact.length - 1]}`;
  }
  return compact.slice(0, 2).toUpperCase();
};
