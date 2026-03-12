import type { SeedRoomSourceInputs, SeedRoomSourceResult } from "./types";
import { useSeedRoomSource } from "./useSeedRoomSource";
import { useGatewayRoomSource } from "./useGatewayRoomSource";

const ROOM_MODE = (import.meta.env.VITE_ROOM_SOURCE ?? "seed") as "seed" | "gateway";
const GATEWAY_URL = (import.meta.env.VITE_OPENCLAW_URL as string) ?? "ws://localhost:18789";
const GATEWAY_TOKEN = (import.meta.env.VITE_OPENCLAW_TOKEN as string) ?? "";

export const useRoomSource: (inputs: SeedRoomSourceInputs) => SeedRoomSourceResult =
  ROOM_MODE === "gateway"
    ? (inputs) => useGatewayRoomSource(inputs, { id: "local", url: GATEWAY_URL, token: GATEWAY_TOKEN })
    : useSeedRoomSource;
