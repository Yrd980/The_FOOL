export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  buildPresenceContestantMap,
  classifyInteractionType,
  deriveLiveConversationState,
  deriveContestantStateFromSession,
  mapGatewayMessage,
  mapSessionsToContestantStates,
  resolveGatewayContestantId,
} from "./gatewayAdapter";
export { buildAgentRegistry, DEFAULT_REGISTRY, lookupContestant } from "./agentRegistry";
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
