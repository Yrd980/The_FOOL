export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  buildPresenceContestantMap,
  classifyInteractionType,
  deriveContestantStateFromSession,
  mapGatewayMessage,
  mapSessionsToContestantStates,
  resolveGatewayContestantId,
} from "./gatewayAdapter";
export { DEFAULT_REGISTRY, lookupContestant } from "./agentRegistry";
export type { ContestantRegistration, AgentRegistry } from "./agentRegistry";
export type {
  AgentPresenceMap,
  AgentPresenceMapping,
  ConnectionEvent,
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  GatewaySessionEntry,
  GatewayStatusResponse,
  Unsubscribe,
} from "./types";
