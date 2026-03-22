import {
  buildGatewayDispatchCommandArgs,
  buildOrchestratorCommandUrl,
  normalizeControlConfigValue,
  normalizeControlDispatchMethod,
  summarizeGatewayOrchestrationContract,
  resolveDangerousCommandConfirmationRequirement,
  satisfiesDangerousCommandConfirmation,
  type CommandEnvelope,
  type GatewayCapabilitySnapshot,
} from "../../src/openclaw/control";
import {
  fail,
  isRecord,
  readString,
  requestLocalOrchestrator,
  resolveConfigValue,
  resolveGatewayToken,
  resolveLocalOrchestratorAuth,
  resolveOrchestratorBaseUrl,
  runOpenClaw,
} from "./support";
import { probeGatewaySession } from "./probe";

export const dispatchOrPreview = async ({
  envelope,
  summary,
}: {
  envelope: CommandEnvelope;
  summary: string;
}): Promise<void> => {
  const configuredOrchestratorUrl = resolveConfigValue("OPENCLAW_ORCHESTRATOR_URL");
  const orchestratorBaseUrl = resolveOrchestratorBaseUrl();
  const hasLocalOrchestratorUrl = Boolean(
    normalizeControlConfigValue(configuredOrchestratorUrl),
  );
  const dispatchMethod = normalizeControlDispatchMethod(
    resolveConfigValue("OPENCLAW_COMMAND_METHOD"),
  );
  const commandParamKey = resolveConfigValue("OPENCLAW_COMMAND_PARAM_KEY");
  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  const token = resolveGatewayToken();

  console.log(`[openclaw-control] ${summary}`);
  console.log(JSON.stringify(envelope, null, 2));

  const confirmationRequirement =
    resolveDangerousCommandConfirmationRequirement(envelope);
  const hasDispatchTarget = hasLocalOrchestratorUrl || Boolean(dispatchMethod);
  if (
    confirmationRequirement &&
    !satisfiesDangerousCommandConfirmation({
      command: envelope,
      requirement: confirmationRequirement,
    })
  ) {
    const message =
      `[openclaw-control] Dangerous ${confirmationRequirement.commandType} command (${confirmationRequirement.reason}) requires --confirm ${JSON.stringify(confirmationRequirement.challenge)} before live dispatch.`;
    if (hasDispatchTarget) {
      fail(message);
    }

    console.log(`${message} Envelope preview only.`);
  } else if (confirmationRequirement && envelope.confirmation) {
    console.log(
      `[openclaw-control] confirmation verified: ${confirmationRequirement.challenge}`,
    );
  }

  if (hasLocalOrchestratorUrl) {
    const { token: localToken } = resolveLocalOrchestratorAuth();
    const responseBody = await requestLocalOrchestrator({
      url: buildOrchestratorCommandUrl(orchestratorBaseUrl),
      token: localToken,
      method: "POST",
      body: {
        command: envelope,
      },
    });

    if (isRecord(responseBody) && isRecord(responseBody.receipt)) {
      const receiptStatus = readString(responseBody.receipt, "status");
      const commandId = readString(responseBody.receipt, "commandId");
      if (receiptStatus) {
        console.log(
          `[openclaw-control] receipt.status=${receiptStatus}${commandId ? ` commandId=${commandId}` : ""}`,
        );
      }
    }

    console.log(
      `[openclaw-control] Dispatched to local authoritative orchestrator ${orchestratorBaseUrl}.`,
    );
    console.log(JSON.stringify(responseBody, null, 2));
    process.exit(0);
  }

  let capabilities: GatewayCapabilitySnapshot | null = null;
  if (token) {
    try {
      const probe = await probeGatewaySession({ gatewayUrl, token });
      capabilities = {
        methods: probe.methods,
        events: probe.events,
      };
      const contract = summarizeGatewayOrchestrationContract({
        capabilities,
        configuredDispatchMethod: dispatchMethod,
      });

      if (contract.note) {
        console.log(`[openclaw-control] ${contract.note}`);
      }

      if (!probe.status.ok && probe.status.error) {
        console.log(
          `[openclaw-control] Raw websocket status probe is still blocked: ${probe.status.error}`,
        );
      }

      if (dispatchMethod && contract.status !== "available") {
        fail(
          `[openclaw-control] Refusing to dispatch with unverified contract. ${contract.note ?? "The live gateway did not confirm the configured dispatch method."}`,
        );
      }
    } catch (error) {
      const message = (error as Error).message;
      if (dispatchMethod) {
        fail(
          `[openclaw-control] Refusing to dispatch until live gateway hello confirms the contract. ${message}`,
        );
      }

      console.log(
        `[openclaw-control] Unable to verify live gateway capabilities: ${message}`,
      );
    }
  }

  if (!dispatchMethod) {
    console.log(
      "[openclaw-control] No OPENCLAW_COMMAND_METHOD configured. Envelope preview only.",
    );
    process.exit(0);
  }

  if (!token) {
    fail(
      "Missing OpenClaw token. Set OPENCLAW_GATEWAY_TOKEN, or make sure ~/.openclaw/openclaw.json contains gateway.auth.token.",
    );
  }

  const args = buildGatewayDispatchCommandArgs({
    dispatchMethod,
    commandEnvelope: envelope,
    gatewayUrl,
    token,
    timeoutMs: 15_000,
    commandParamKey,
  });

  return runOpenClaw(args);
};
