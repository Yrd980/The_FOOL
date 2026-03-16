#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildGatewayAgentCallArgs,
  buildMoveMessage,
  normalizeControlConfigValue,
  resolveControlRoomId,
} from "../src/room/gateway/openClawControl";

type CommandName = "move" | "say";

const USAGE = `Usage:
  bun run openclaw:control -- move <agent-id> <room>
  bun run openclaw:control -- say <agent-id> <room> <message>

Rooms:
  main | lobby-plaza | print-shop | clinic | convenience | quiet-zone
  team-room-1 | team-room-2 | team-room-3 | main-stage | quiet-orbit`;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const devRoot = path.resolve(scriptDir, "..");
const envFilePath = path.join(devRoot, ".env.local");

const parseEnvFile = (filePath: string): Record<string, string> => {
  try {
    const source = readFileSync(filePath, "utf8");
    const entries = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index < 0) return null;
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return key ? [key, value] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const envFile = parseEnvFile(envFilePath);

const resolveConfigValue = (key: string): string | undefined =>
  normalizeControlConfigValue(process.env[key]) ?? normalizeControlConfigValue(envFile[key]);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const [command, agentId, room, ...messageParts] = process.argv.slice(2);

if (!command || !agentId || !room) {
  fail(USAGE);
}

const normalizedCommand = command as CommandName;
if (normalizedCommand !== "move" && normalizedCommand !== "say") {
  fail(`Unknown command "${command}".\n\n${USAGE}`);
}

const message =
  normalizedCommand === "move"
    ? buildMoveMessage(room)
    : messageParts.join(" ").trim();

if (!message) {
  fail(`A message is required for "${normalizedCommand}".\n\n${USAGE}`);
}

const token = resolveConfigValue("OPENCLAW_GATEWAY_TOKEN") ?? resolveConfigValue("VITE_OPENCLAW_TOKEN");
if (!token) {
  fail("Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN or VITE_OPENCLAW_TOKEN.");
}

const gatewayUrl =
  resolveConfigValue("OPENCLAW_GATEWAY_URL") ??
  resolveConfigValue("VITE_OPENCLAW_URL");
const roomId = resolveControlRoomId(room);
const idempotencyKey = `roomctl-${agentId}-${roomId}-${Date.now()}`;

const args = buildGatewayAgentCallArgs({
  agentId,
  room,
  message,
  timeoutSeconds: 120,
  gatewayUrl,
  token,
  idempotencyKey,
});

console.log(
  `[openclaw-control] ${normalizedCommand} ${agentId} -> ${roomId} (${message})`,
);

const result = spawnSync("openclaw", args, {
  cwd: devRoot,
  stdio: "inherit",
});

if (result.error) {
  fail(`Failed to run openclaw: ${result.error.message}`);
}

process.exit(result.status ?? 0);
