import {
  buildGatewayAgentCallArgs,
  buildMoveMessage,
  resolveControlRoomId,
} from "../../../src/openclaw/control";
import { resolveAgentCommandActivityContext } from "../probe";
import { parseLongOptions } from "../parse";
import {
  fail,
  resolveConfigValue,
  resolveGatewayToken,
  runOpenClaw,
  USAGE,
} from "../support";

export const handleMoveOrSay = async (
  command: "move" | "say",
  args: string[],
): Promise<void> => {
  const { positional, options } = parseLongOptions(args);
  const [agentId, room, ...messageParts] = positional;
  if (!agentId || !room) {
    fail(USAGE);
  }
  if (options["activity-package-id"]?.trim()) {
    fail(
      "[openclaw-control] --activity-package-id fallback has been removed. Use --activity-run-id with an authoritative orchestrator snapshot.",
    );
  }
  const activityRunId = options["activity-run-id"]?.trim();
  if (!activityRunId) {
    fail(
      "[openclaw-control] move/say now require --activity-run-id so room aliases resolve from authoritative snapshot.world only.",
    );
  }

  const activityContext = await resolveAgentCommandActivityContext({
    activityRunId,
  });

  if (activityContext.note) {
    console.log(`[openclaw-control] ${activityContext.note}`);
  }

  if (!activityContext.roomCatalog) {
    fail(
      "[openclaw-control] move/say room aliases now require authoritative snapshot.world. Ensure OPENCLAW_ORCHESTRATOR_URL and OPENCLAW_ORCHESTRATOR_TOKEN point at this repo's orchestrator for the requested activity run.",
    );
  }

  const roomResolutionOptions = {
    roomCatalog: activityContext.roomCatalog,
  } as const;

  const message =
    command === "move"
      ? buildMoveMessage(
          room,
          activityContext.activityPackageId ?? undefined,
          roomResolutionOptions,
        )
      : messageParts.join(" ").trim();

  if (!message) {
    fail(`A message is required for "${command}".\n\n${USAGE}`);
  }

  const token = resolveGatewayToken();
  if (!token) {
    fail(
      "Missing OpenClaw gateway token. Set OPENCLAW_GATEWAY_TOKEN.",
    );
  }

  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  const roomId = resolveControlRoomId(
    room,
    activityContext.activityPackageId ?? undefined,
    roomResolutionOptions,
  );
  const idempotencyKey = `roomctl-${agentId}-${roomId}-${Date.now()}`;

  const openClawArgs = buildGatewayAgentCallArgs({
    agentId,
    room,
    message,
    timeoutSeconds: 120,
    gatewayUrl,
    token,
    idempotencyKey,
    activityPackageId: activityContext.activityPackageId,
    roomCatalog: activityContext.roomCatalog,
  });

  console.log(
    `[openclaw-control] ${command} ${agentId} -> ${roomId} (${message})`,
  );
  runOpenClaw(openClawArgs);
};
