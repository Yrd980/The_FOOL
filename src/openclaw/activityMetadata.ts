export type ActivityStageDeskMode = "submission" | "score";

export interface ActivitySummaryStatMeta {
  label: string;
  value: string;
  note: string;
}

export interface ActivityIntegrationDocMeta {
  title: string;
  href: string;
  summary: string;
  accent: string;
}

export interface ActivityOperatorCommandMeta {
  label: string;
  command: string;
  note: string;
}

export interface ActivityRoomAliasMeta {
  roomId: string;
  aliases: string[];
}

export interface ActivityRoomsMeta {
  fallbackRoomId?: string;
  aliases?: ActivityRoomAliasMeta[];
}

export interface ActivityStageMetadata {
  label?: string;
  summary: string;
  contestantActions: string[];
  humanActions: string[];
  systemSignals: string[];
  operatorHint: string;
  successSignal: string;
  preferredRoomIds?: string[];
  scene?: {
    deskMode?: ActivityStageDeskMode;
  };
}

export interface ActivityUiMetadata {
  badgeLabel: string;
  title: string;
  description: string;
  summaryStats: ActivitySummaryStatMeta[];
  integrationDocs: ActivityIntegrationDocMeta[];
  operatorCommands: ActivityOperatorCommandMeta[];
  rooms?: ActivityRoomsMeta;
  stages: Record<string, ActivityStageMetadata>;
}
