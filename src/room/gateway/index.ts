export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  classifyInteractionType,
  deriveContestantState,
  mapGatewayMessage,
  mapPresenceToContestantStates,
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
