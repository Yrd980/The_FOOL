export interface SummaryStat {
  label: string;
  value: string;
  note: string;
}

export interface StageDefinition {
  id: string;
  label: string;
  title: string;
  summary: string;
  contestantActions: string[];
  humanActions: string[];
  systemSignals: string[];
}

export interface ProductSurface {
  title: string;
  summary: string;
  bullets: string[];
}

export interface IntegrationDoc {
  title: string;
  href: string;
  summary: string;
  accent: string;
}

export interface IntegrationStep {
  title: string;
  summary: string;
  bullets: string[];
}

export interface OperatorCommand {
  label: string;
  command: string;
  note: string;
}

export interface ReviewLane {
  title: string;
  summary: string;
  bullets: string[];
}
