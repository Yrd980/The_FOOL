export const KNOWN_COMMANDS = [
  "probe",
  "move",
  "say",
  "talk",
  "broadcast",
  "reaction",
  "bet",
  "vote",
  "stage",
  "finish",
  "start-timer",
  "open-submission",
  "submit",
  "update-submission",
  "lock-submission",
  "submit-score",
  "grant-award",
  "draw",
  "move-entity",
  "assign-team",
  "ascii",
  "snapshot",
  "scores",
  "events",
  "replay",
  "audit",
  "command",
] as const;

export type CommandName = (typeof KNOWN_COMMANDS)[number];

export type ControlCommandHandler = (args: string[]) => Promise<void>;

export const isCommandName = (value: string): value is CommandName =>
  KNOWN_COMMANDS.includes(value as CommandName);
