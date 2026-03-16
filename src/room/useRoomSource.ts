import type { SeedRoomSourceInputs, SeedRoomSourceResult } from "./types";
import { useSeedRoomSource } from "./useSeedRoomSource";
import { useGatewayRoomSource } from "./useGatewayRoomSource";

const ROOM_MODE = (import.meta.env.VITE_ROOM_SOURCE ?? "seed") as "seed" | "gateway";
const LOCAL_PROXY_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_PROXY_PATH = "/ws";
const LOCAL_PROXY_PORTS = new Set(["4173", "5173"]);

export const resolveGatewayUrl = (
  configuredUrl: string | undefined,
  currentLocation?: Pick<Location, "protocol" | "host">,
): string => {
  const fallbackUrl = configuredUrl ?? "ws://localhost:18789";
  if (!currentLocation) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(fallbackUrl);
    const isLocalProxyUrl =
      (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      LOCAL_PROXY_HOSTS.has(parsed.hostname) &&
      parsed.pathname === LOCAL_PROXY_PATH &&
      LOCAL_PROXY_PORTS.has(parsed.port);

    if (!isLocalProxyUrl) {
      return fallbackUrl;
    }

    const wsProtocol = currentLocation.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${currentLocation.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return fallbackUrl;
  }
};

const GATEWAY_URL = resolveGatewayUrl(
  import.meta.env.VITE_OPENCLAW_URL as string | undefined,
  typeof window !== "undefined" ? window.location : undefined,
);
const GATEWAY_TOKEN = (import.meta.env.VITE_OPENCLAW_TOKEN as string) ?? "";

export const useRoomSource: (inputs: SeedRoomSourceInputs) => SeedRoomSourceResult =
  ROOM_MODE === "gateway"
    ? (inputs) => useGatewayRoomSource(inputs, { id: "local", url: GATEWAY_URL, token: GATEWAY_TOKEN })
    : useSeedRoomSource;
