import type {
  GatewayAuthoritativeQueryStatus,
  GatewaySessionSummary,
  GatewaySkillBindingSummary,
  GatewaySkillDocumentSummary,
  GatewaySkillSummary,
  GatewayStructuredStateSummary,
  GatewayWorldEntitySummary,
  GatewayWorldRoomSummary,
  GatewayWorldSummary,
  GatewayWorldTeamSummary,
} from "../types";
import { getRoomLabel } from "./control";
import type {
  GatewaySkillSnapshot,
  GatewayWorldSnapshot,
} from "./gateway/types";

const formatTeamLabel = (teamId: string): string => {
  const match = teamId.match(/^team-(\d+)$/);
  return match ? `Team ${match[1]}` : teamId;
};

const sortEntitySummaries = (
  left: GatewayWorldEntitySummary,
  right: GatewayWorldEntitySummary,
): number => {
  if ((left.teamId ?? "") !== (right.teamId ?? "")) {
    return (left.teamId ?? "").localeCompare(right.teamId ?? "");
  }

  return left.entityId.localeCompare(right.entityId);
};

const sortTeamSummaries = (
  left: GatewayWorldTeamSummary,
  right: GatewayWorldTeamSummary,
): number => left.teamId.localeCompare(right.teamId);

const sortRoomSummaries = (
  left: GatewayWorldRoomSummary,
  right: GatewayWorldRoomSummary,
): number => left.roomId.localeCompare(right.roomId);

const resolveRoomLabel = (
  roomId: string | null,
  roomLabelById: Map<string, string>,
  activityPackageId?: string | null,
): string | null => {
  if (!roomId) {
    return null;
  }

  return (
    roomLabelById.get(roomId) ??
    getRoomLabel(roomId, activityPackageId ?? undefined)
  );
};

const buildStructuredStateSummary = ({
  sectionLabel,
  authoritativeValue,
  gatewayValue,
  hasAuthoritativeSnapshot,
  queryStatus,
}: {
  sectionLabel: "snapshot.world" | "snapshot.skills";
  authoritativeValue: GatewayWorldSnapshot | GatewaySkillSnapshot[] | null | undefined;
  gatewayValue: GatewayWorldSnapshot | GatewaySkillSnapshot[] | null | undefined;
  hasAuthoritativeSnapshot: boolean;
  queryStatus: GatewayAuthoritativeQueryStatus;
}): GatewayStructuredStateSummary => {
  if (authoritativeValue !== null && authoritativeValue !== undefined) {
    return {
      available: true,
      source: "authoritative-query-snapshot",
      reason: null,
    };
  }

  if (gatewayValue !== null && gatewayValue !== undefined) {
    return {
      available: true,
      source: "gateway-snapshot",
      reason: null,
    };
  }

  if (hasAuthoritativeSnapshot) {
    return {
      available: false,
      source: "authoritative-query-snapshot",
      reason: `Authoritative snapshot is readable, but ${sectionLabel} is missing.`,
    };
  }

  if (queryStatus.reason) {
    return {
      available: false,
      source: "unavailable",
      reason: queryStatus.reason,
    };
  }

  if (queryStatus.status === "syncing") {
    return {
      available: false,
      source: "unavailable",
      reason: `Waiting for the first ${sectionLabel} sync.`,
    };
  }

  if (queryStatus.status === "disabled") {
    return {
      available: false,
      source: "unavailable",
      reason: `${sectionLabel} is unavailable because authoritative queries are disabled.`,
    };
  }

  return {
    available: false,
    source: "unavailable",
    reason: `No ${sectionLabel} payload has been observed yet.`,
  };
};

const buildWorldEntitySummary = ({
  entityId,
  kind,
  roomId,
  teamId,
  teamLabel,
  roomLabelById,
  sessionByAgentId,
  activityPackageId,
}: {
  entityId: string;
  kind: string;
  roomId: string | null;
  teamId: string | null;
  teamLabel: string | null;
  roomLabelById: Map<string, string>;
  sessionByAgentId: Map<string, GatewaySessionSummary>;
  activityPackageId?: string | null;
}): GatewayWorldEntitySummary => {
  const liveSession = sessionByAgentId.get(entityId) ?? null;

  return {
    entityId,
    label: entityId,
    kind,
    roomId,
    roomLabel: resolveRoomLabel(roomId, roomLabelById, activityPackageId),
    teamId,
    teamLabel,
    liveRoomId: liveSession?.roomId ?? null,
    liveRoomLabel: liveSession?.roomLabel ?? null,
    liveState: liveSession?.state ?? null,
    liveStateLabel: liveSession?.stateLabel ?? null,
  };
};

export const buildGatewayWorldSummary = ({
  authoritativeWorld,
  gatewayWorld,
  hasAuthoritativeSnapshot,
  queryStatus,
  sessions,
  activityPackageId,
}: {
  authoritativeWorld: GatewayWorldSnapshot | null | undefined;
  gatewayWorld: GatewayWorldSnapshot | null | undefined;
  hasAuthoritativeSnapshot: boolean;
  queryStatus: GatewayAuthoritativeQueryStatus;
  sessions: GatewaySessionSummary[];
  activityPackageId?: string | null;
}): GatewayWorldSummary => {
  const state = buildStructuredStateSummary({
    sectionLabel: "snapshot.world",
    authoritativeValue: authoritativeWorld,
    gatewayValue: gatewayWorld,
    hasAuthoritativeSnapshot,
    queryStatus,
  });
  const rawWorld = authoritativeWorld ?? gatewayWorld ?? null;

  if (!rawWorld) {
    return {
      ...state,
      rooms: [],
      teams: [],
      entities: [],
      unassignedEntities: [],
    };
  }

  const roomLabelById = new Map(
    rawWorld.rooms.map((room) => [
      room.id,
      room.label?.trim() ||
        getRoomLabel(room.id, activityPackageId ?? undefined),
    ]),
  );
  const sessionByAgentId = new Map(
    sessions.map((session) => [session.agentId, session]),
  );
  const teamMembershipByEntityId = new Map<
    string,
    { teamId: string; teamLabel: string; teamRoomId: string | null }
  >();

  for (const team of rawWorld.teams) {
    for (const memberId of team.memberIds) {
      teamMembershipByEntityId.set(memberId, {
        teamId: team.id,
        teamLabel: formatTeamLabel(team.id),
        teamRoomId: team.roomId ?? null,
      });
    }
  }

  const entityRecords = new Map<
    string,
    { id: string; kind: string; roomId: string | null }
  >(
    rawWorld.entities.map((entity) => [
      entity.id,
      {
        id: entity.id,
        kind: entity.kind,
        roomId: entity.roomId ?? null,
      },
    ]),
  );

  for (const team of rawWorld.teams) {
    for (const memberId of team.memberIds) {
      if (!entityRecords.has(memberId)) {
        entityRecords.set(memberId, {
          id: memberId,
          kind: "agent",
          roomId: null,
        });
      }
    }
  }

  const entities = [...entityRecords.values()]
    .map((entity) => {
      const membership = teamMembershipByEntityId.get(entity.id) ?? null;
      return buildWorldEntitySummary({
        entityId: entity.id,
        kind: entity.kind,
        roomId: entity.roomId,
        teamId: membership?.teamId ?? null,
        teamLabel: membership?.teamLabel ?? null,
        roomLabelById,
        sessionByAgentId,
        activityPackageId,
      });
    })
    .sort(sortEntitySummaries);

  const entityById = new Map(entities.map((entity) => [entity.entityId, entity]));
  const roomIds = new Set<string>(rawWorld.rooms.map((room) => room.id));

  for (const team of rawWorld.teams) {
    if (team.roomId) {
      roomIds.add(team.roomId);
    }
  }

  for (const entity of entities) {
    if (entity.roomId) {
      roomIds.add(entity.roomId);
    }
  }

  const teams = rawWorld.teams
    .map((team) => {
      const members = team.memberIds
        .map((memberId) => entityById.get(memberId))
        .filter((member): member is GatewayWorldEntitySummary => member !== undefined);
      const memberRoomLabels = [...new Set(
        members
          .map((member) => member.roomLabel)
          .filter((roomLabel): roomLabel is string => Boolean(roomLabel)),
      )];
      const alignedWithTeamRoom =
        Boolean(team.roomId) &&
        members.length > 0 &&
        members.every((member) => member.roomId === team.roomId);

      let placementStatus: GatewayWorldTeamSummary["placementStatus"] = "unassigned";
      let placementDetail = "No authoritative team-room mapping yet.";

      if (members.length === 0) {
        placementDetail = "No authoritative team members are listed yet.";
      } else if (alignedWithTeamRoom) {
        placementStatus = "aligned";
        placementDetail = `${members.length} members authoritative in ${resolveRoomLabel(team.roomId ?? null, roomLabelById) ?? team.roomId ?? "the mapped room"}.`;
      } else if (team.roomId && memberRoomLabels.length === 0) {
        placementDetail = `${formatTeamLabel(team.id)} maps to ${resolveRoomLabel(team.roomId, roomLabelById) ?? team.roomId}, but member placements are missing.`;
      } else if (team.roomId) {
        placementStatus = "mixed";
        placementDetail = `${formatTeamLabel(team.id)} maps to ${resolveRoomLabel(team.roomId, roomLabelById) ?? team.roomId}, but members currently span ${memberRoomLabels.join(" / ")}.`;
      } else if (memberRoomLabels.length > 0) {
        placementStatus = "mixed";
        placementDetail = `${formatTeamLabel(team.id)} members currently span ${memberRoomLabels.join(" / ")} without a team room mapping.`;
      }

      return {
        teamId: team.id,
        label: formatTeamLabel(team.id),
        roomId: team.roomId ?? null,
        roomLabel: resolveRoomLabel(team.roomId ?? null, roomLabelById),
        memberCount: members.length,
        members,
        placementStatus,
        placementDetail,
      };
    })
    .sort(sortTeamSummaries);

  const rooms = [...roomIds]
    .map((roomId) => {
      const occupants = entities.filter((entity) => entity.roomId === roomId);
      const teamsInRoom = teams.filter((team) => team.roomId === roomId);
      const teamMemberCount = teamsInRoom.reduce(
        (total, team) => total + team.memberCount,
        0,
      );
      return {
        roomId,
        label: resolveRoomLabel(roomId, roomLabelById) ?? roomId,
        teamCount: teamsInRoom.length,
        memberCount: teamMemberCount,
        occupantCount: occupants.length,
        teamIds: teamsInRoom.map((team) => team.teamId),
        occupantIds: occupants.map((entity) => entity.entityId),
      };
    })
    .sort(sortRoomSummaries);

  return {
    ...state,
    rooms,
    teams,
    entities,
    unassignedEntities: entities.filter((entity) => entity.teamId === null),
  };
};

export const buildGatewaySkillSummary = ({
  authoritativeSkills,
  gatewaySkills,
  hasAuthoritativeSnapshot,
  queryStatus,
  currentStageId,
}: {
  authoritativeSkills: GatewaySkillSnapshot[] | null | undefined;
  gatewaySkills: GatewaySkillSnapshot[] | null | undefined;
  hasAuthoritativeSnapshot: boolean;
  queryStatus: GatewayAuthoritativeQueryStatus;
  currentStageId: string | null;
}): GatewaySkillSummary => {
  const state = buildStructuredStateSummary({
    sectionLabel: "snapshot.skills",
    authoritativeValue: authoritativeSkills,
    gatewayValue: gatewaySkills,
    hasAuthoritativeSnapshot,
    queryStatus,
  });
  const rawBindings = authoritativeSkills ?? gatewaySkills ?? null;

  if (!rawBindings) {
    return {
      ...state,
      currentStageId,
      currentStageReason: state.reason,
      bindings: [],
      currentStageBindings: [],
      globalBindings: [],
      documents: [],
    };
  }

  const bindings = rawBindings
    .map((binding) => {
      const stageId = binding.stageId ?? null;
      const isCurrentStage = Boolean(currentStageId && stageId === currentStageId);
      return {
        id: `${binding.role}:${stageId ?? "global"}:${binding.docId}:${binding.version}`,
        role: binding.role,
        stageId,
        scopeLabel: stageId ? `Stage · ${stageId}` : "Global",
        docId: binding.docId,
        version: binding.version,
        isCurrentStage,
      } satisfies GatewaySkillBindingSummary;
    })
    .sort((left, right) => {
      if (left.isCurrentStage !== right.isCurrentStage) {
        return Number(right.isCurrentStage) - Number(left.isCurrentStage);
      }

      if (left.stageId === null && right.stageId !== null) {
        return -1;
      }

      if (left.stageId !== null && right.stageId === null) {
        return 1;
      }

      if ((left.stageId ?? "") !== (right.stageId ?? "")) {
        return (left.stageId ?? "").localeCompare(right.stageId ?? "");
      }

      if (left.role !== right.role) {
        return left.role.localeCompare(right.role);
      }

      if (left.docId !== right.docId) {
        return left.docId.localeCompare(right.docId);
      }

      return left.version.localeCompare(right.version);
    });
  const currentStageBindings = currentStageId
    ? bindings.filter((binding) => binding.stageId === currentStageId)
    : [];
  const globalBindings = bindings.filter((binding) => binding.stageId === null);
  const documentMap = new Map<string, GatewaySkillDocumentSummary>();

  for (const binding of bindings) {
    const key = `${binding.docId}:${binding.version}`;
    const existing = documentMap.get(key);
    if (existing) {
      existing.bindingCount += 1;
      if (!existing.roles.includes(binding.role)) {
        existing.roles.push(binding.role);
      }
      if (binding.stageId && !existing.stageIds.includes(binding.stageId)) {
        existing.stageIds.push(binding.stageId);
      }
      existing.currentStage = existing.currentStage || binding.isCurrentStage;
      continue;
    }

    documentMap.set(key, {
      id: key,
      docId: binding.docId,
      version: binding.version,
      bindingCount: 1,
      roles: [binding.role],
      stageIds: binding.stageId ? [binding.stageId] : [],
      currentStage: binding.isCurrentStage,
    });
  }

  const documents = [...documentMap.values()].sort((left, right) => {
    if (left.currentStage !== right.currentStage) {
      return Number(right.currentStage) - Number(left.currentStage);
    }

    if (left.bindingCount !== right.bindingCount) {
      return right.bindingCount - left.bindingCount;
    }

    return left.id.localeCompare(right.id);
  });

  let currentStageReason: string | null = null;
  if (!state.available) {
    currentStageReason = state.reason;
  } else if (currentStageId && currentStageBindings.length === 0 && globalBindings.length > 0) {
    currentStageReason = `No stage-specific bindings for ${currentStageId}; relying on global docs.`;
  } else if (currentStageId && currentStageBindings.length === 0) {
    currentStageReason = `No skill bindings are published for ${currentStageId}.`;
  }

  return {
    ...state,
    currentStageId,
    currentStageReason,
    bindings,
    currentStageBindings,
    globalBindings,
    documents,
  };
};
