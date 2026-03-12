export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  buildPresenceContestantMap,
  classifyInteractionType,
  deriveContestantState,
  mapGatewayMessage,
  mapPresenceToContestantStates,
  resolveGatewayContestantId,
} from "./gatewayAdapter";
export type {
  AgentPresenceMap,
  AgentPresenceMapping,
  ConnectionEvent,
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  Unsubscribe,
} from "./types";
