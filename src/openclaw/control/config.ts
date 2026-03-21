import type { GatewayCapabilitySnapshot } from "./types";
import { DEFAULT_ORCHESTRATOR_HTTP_URL } from "./types";
import { hasWrappingQuotes } from "./support";

const DIRECT_GATEWAY_URL = "ws://127.0.0.1:18789";
const DEFAULT_COMMAND_PARAM_KEY = "command";
const KNOWN_ORCHESTRATION_EVENT_PREFIXES = [
  "activity.",
  "stage.",
  "timer.",
  "submission.",
  "judge.",
  "award.",
  "entity.",
  "team.",
  "draw.",
  "agent.",
  "broadcast.",
  "reaction.",
  "bet.",
  "vote.",
] as const;

export const normalizeControlConfigValue = (
  value: string | undefined,
): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return hasWrappingQuotes(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
};

export const normalizeControlDispatchMethod = (
  value: string | undefined,
): string | undefined => normalizeControlConfigValue(value);

export const normalizeControlCommandParamKey = (
  value: string | undefined,
): string => normalizeControlConfigValue(value) ?? DEFAULT_COMMAND_PARAM_KEY;

export const isKnownOrchestrationEvent = (eventName: string): boolean =>
  KNOWN_ORCHESTRATION_EVENT_PREFIXES.some((prefix) =>
    eventName.startsWith(prefix),
  );

export const summarizeGatewayOrchestrationContract = ({
  capabilities,
  configuredDispatchMethod,
}: {
  capabilities: GatewayCapabilitySnapshot;
  configuredDispatchMethod?: string;
}): {
  status: "available" | "blocked" | "unknown";
  note: string | null;
} => {
  const methods = capabilities.methods.filter(
    (method): method is string => typeof method === "string" && method.trim().length > 0,
  );
  const events = capabilities.events.filter(
    (event): event is string => typeof event === "string" && event.trim().length > 0,
  );

  if (methods.length === 0 && events.length === 0) {
    return { status: "unknown", note: null };
  }

  if (configuredDispatchMethod) {
    if (methods.includes(configuredDispatchMethod)) {
      return {
        status: "available",
        note: `Live gateway hello advertises ${configuredDispatchMethod}.`,
      };
    }

    return {
      status: "blocked",
      note: `Live gateway hello advertises ${methods.length} methods / ${events.length} events, but not ${configuredDispatchMethod}.`,
    };
  }

  const orchestrationEvents = events.filter(isKnownOrchestrationEvent);
  if (orchestrationEvents.length > 0) {
    return {
      status: "unknown",
      note: `Live gateway advertises orchestration-like events: ${orchestrationEvents.slice(0, 4).join(", ")}.`,
    };
  }

  return {
    status: "blocked",
    note:
      "Live gateway hello does not advertise stage/timer/submission/award events or any verified orchestration dispatch method.",
  };
};

export const normalizeControlGatewayUrl = (
  configuredUrl: string | undefined,
): string => {
  const normalized = normalizeControlConfigValue(configuredUrl);
  if (!normalized) {
    return DIRECT_GATEWAY_URL;
  }

  try {
    const parsed = new URL(normalized);
    if ((parsed.protocol === "ws:" || parsed.protocol === "wss:") && parsed.pathname === "/") {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return normalized;
  }

  return normalized;
};

export const normalizeOrchestratorBaseUrl = (
  value: string | undefined,
): string => {
  const normalized = normalizeControlConfigValue(value);
  if (!normalized) {
    return DEFAULT_ORCHESTRATOR_HTTP_URL;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "ws:") {
      parsed.protocol = "http:";
    } else if (parsed.protocol === "wss:") {
      parsed.protocol = "https:";
    }

    if (parsed.pathname === "/") {
      parsed.pathname = "";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return normalized.replace(/\/$/, "");
  }
};
