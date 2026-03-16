const DIRECT_GATEWAY_URL = "ws://127.0.0.1:18789";
const LOCAL_PROXY_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_PROXY_PATH = "/ws";
const LOCAL_PROXY_PORTS = new Set(["4173", "5173"]);

const ROOM_ALIASES: Record<string, string> = {
  main: "main-stage",
  "main-stage": "main-stage",
  lobby: "main-stage",
  "lobby-plaza": "main-stage",
  plaza: "main-stage",

  "team-room-1": "team-room-1",
  "team-1": "team-room-1",
  team1: "team-room-1",
  "print-shop": "team-room-1",
  printshop: "team-room-1",
  print: "team-room-1",

  "team-room-2": "team-room-2",
  "team-2": "team-room-2",
  team2: "team-room-2",
  clinic: "team-room-2",

  "team-room-3": "team-room-3",
  "team-3": "team-room-3",
  team3: "team-room-3",
  convenience: "team-room-3",
  store: "team-room-3",

  "quiet-orbit": "quiet-orbit",
  quiet: "quiet-orbit",
  "quiet-zone": "quiet-orbit",
};

const ROOM_LABELS: Record<string, string> = {
  "main-stage": "Main Stage",
  "team-room-1": "Print Shop",
  "team-room-2": "Clinic",
  "team-room-3": "Convenience",
  "quiet-orbit": "Quiet Zone",
};

const normalizeAlias = (room: string): string =>
  room.trim().toLowerCase().replace(/[\s_]+/g, "-");

const normalizeAgentId = (agentId: string): string => {
  const normalized = agentId.trim();
  if (!normalized) {
    throw new Error("Agent id is required.");
  }
  return normalized;
};

const hasWrappingQuotes = (value: string): boolean =>
  value.length >= 2 &&
  ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")));

export const normalizeControlConfigValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return hasWrappingQuotes(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
};

export const resolveControlRoomId = (room: string): string => {
  const resolved = ROOM_ALIASES[normalizeAlias(room)];
  if (!resolved) {
    throw new Error(
      `Unknown room alias "${room}". Use main-stage, team-room-1, team-room-2, team-room-3, or quiet-orbit.`,
    );
  }
  return resolved;
};

export const buildGatewaySessionKey = (agentId: string, room: string): string =>
  `agent:${normalizeAgentId(agentId)}:${resolveControlRoomId(room)}`;

export const normalizeControlGatewayUrl = (configuredUrl: string | undefined): string => {
  const raw = configuredUrl?.trim();
  if (!raw) {
    return DIRECT_GATEWAY_URL;
  }

  try {
    const parsed = new URL(raw);
    const isLocalProxyUrl =
      (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      LOCAL_PROXY_HOSTS.has(parsed.hostname) &&
      parsed.pathname === LOCAL_PROXY_PATH &&
      LOCAL_PROXY_PORTS.has(parsed.port);

    if (isLocalProxyUrl) {
      return DIRECT_GATEWAY_URL;
    }

    if ((parsed.protocol === "ws:" || parsed.protocol === "wss:") && parsed.pathname === "/") {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return raw;
  }

  return raw;
};

export const buildMoveMessage = (room: string): string => {
  const roomId = resolveControlRoomId(room);
  const label = ROOM_LABELS[roomId] ?? roomId;
  return `Move to ${label}. Reply with one short line only.`;
};

export const buildGatewayAgentCallArgs = ({
  agentId,
  room,
  message,
  timeoutSeconds,
  gatewayUrl,
  token,
  idempotencyKey,
}: {
  agentId: string;
  room: string;
  message: string;
  timeoutSeconds: number;
  gatewayUrl?: string;
  token?: string;
  idempotencyKey: string;
}): string[] => {
  const normalizedAgentId = normalizeAgentId(agentId);
  const sessionKey = buildGatewaySessionKey(normalizedAgentId, room);
  const normalizedGatewayUrl = normalizeControlGatewayUrl(gatewayUrl);
  const args = [
    "gateway",
    "call",
    "agent",
    "--expect-final",
    "--timeout",
    String(Math.max(10_000, (timeoutSeconds + 60) * 1_000)),
    "--url",
    normalizedGatewayUrl,
  ];

  if (token?.trim()) {
    args.push("--token", token.trim());
  }

  args.push(
    "--json",
    "--params",
    JSON.stringify({
      agentId: normalizedAgentId,
      message: message.trim(),
      sessionKey,
      timeout: timeoutSeconds,
      idempotencyKey,
    }),
  );

  return args;
};
