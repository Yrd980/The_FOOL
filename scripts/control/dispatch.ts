import {
  buildOrchestratorCommandUrl,
  resolveDangerousCommandConfirmationRequirement,
  satisfiesDangerousCommandConfirmation,
  type CommandEnvelope,
} from "../../src/openclaw/control";
import {
  fail,
  isRecord,
  readString,
  requestLocalOrchestrator,
  resolveLocalOrchestratorAuth,
  resolveOrchestratorBaseUrl,
} from "./support";

export const dispatchOrPreview = async ({
  envelope,
  summary,
}: {
  envelope: CommandEnvelope;
  summary: string;
}): Promise<void> => {
  const orchestratorBaseUrl = resolveOrchestratorBaseUrl();

  console.log(`[openclaw-control] ${summary}`);
  console.log(JSON.stringify(envelope, null, 2));

  const confirmationRequirement =
    resolveDangerousCommandConfirmationRequirement(envelope);
  if (
    confirmationRequirement &&
    !satisfiesDangerousCommandConfirmation({
      command: envelope,
      requirement: confirmationRequirement,
    })
  ) {
    fail(
      `[openclaw-control] Dangerous ${confirmationRequirement.commandType} command (${confirmationRequirement.reason}) requires --confirm ${JSON.stringify(confirmationRequirement.challenge)} before live dispatch.`,
    );
  }

  if (confirmationRequirement && envelope.confirmation) {
    console.log(
      `[openclaw-control] confirmation verified: ${confirmationRequirement.challenge}`,
    );
  }

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
};
