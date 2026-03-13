export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  classifyInteractionType,
  deriveContestantStateFromSession,
  mapGatewayMessage,
  mapSessionsToContestantStates,
} from "./gatewayAdapter";
export { DEFAULT_REGISTRY, lookupContestant } from "./agentRegistry";
export type { ContestantRegistration, AgentRegistry } from "./agentRegistry";
export type {
  ConnectionEvent,
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  GatewaySessionEntry,
  GatewayStatusResponse,
  Unsubscribe,
} from "./types";
