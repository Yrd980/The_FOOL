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

  const activityContext = await resolveAgentCommandActivityContext({
    activityRunId: options["activity-run-id"]?.trim(),
    explicitActivityPackageId: options["activity-package-id"]?.trim(),
  });

  if (activityContext.note) {
    console.log(`[openclaw-control] ${activityContext.note}`);
  }

  if (!activityContext.roomCatalog) {
    fail(
      "[openclaw-control] move/say room aliases are now activity-scoped. Configure OPENCLAW_ORCHESTRATOR_URL so the CLI can read snapshot.world, or pass --activity-package-id <id> for an explicit bootstrap/dev alias fallback.",
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
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
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
