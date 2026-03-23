import type { GatewayScoreSummarySnapshot, GatewaySubmissionSnapshot, GatewayTimerSnapshot } from "./gateway/types";
import type { DescribedEvent, OpenClawAsciiOverviewReadModel } from "./asciiOverviewReadModel";
import {
  ASCII_IDLE_LABEL,
  formatClockLabel,
  formatDateTimeLabel,
  formatDurationLabel,
  formatEntityLabel,
  formatStageLabel,
  formatStageTitle,
  formatTeamLabel,
  unique,
} from "./asciiOverviewSupport";

const renderSection = (
  lines: string[],
  title: string,
  content: string[],
): void => {
  lines.push("");
  lines.push(title);
  lines.push("-".repeat(title.length));
  if (content.length === 0) {
    lines.push("(none)");
    return;
  }
  lines.push(...content);
};

const renderStageLadder = ({
  stageTemplates,
  currentStageId,
  stageHistory,
}: {
  stageTemplates: OpenClawAsciiOverviewReadModel["stageTemplates"];
  currentStageId: string | null;
  stageHistory: string[];
}): string[] => {
  if (stageTemplates.length === 0) {
    return ["(no authoritative stage templates yet)"];
  }

  const currentIndex = stageTemplates.findIndex((entry) => entry.id === currentStageId);
  const visited = new Set(stageHistory);

  const lines = stageTemplates.map((stageTemplate, index) => {
    const marker =
      stageTemplate.id === currentStageId
        ? "[>]"
        : currentIndex >= 0
          ? index < currentIndex
            ? "[x]"
            : "[ ]"
          : visited.has(stageTemplate.id)
            ? "[x]"
            : "[ ]";
    const suffix =
      stageTemplate.id === currentStageId && stageTemplate.allowedActions?.length
        ? ` actions=${stageTemplate.allowedActions.join(",")}`
        : "";
    return `${marker} ${formatStageTitle(stageTemplate)}${suffix}`;
  });

  if (stageHistory.length > 0) {
    lines.push(`history  : ${stageHistory.join(" -> ")}`);
  }

  return lines;
};

const renderRooms = ({
  rooms,
  teams,
  entities,
}: NonNullable<OpenClawAsciiOverviewReadModel["world"]>): string[] => {
  if (rooms.length === 0) {
    return ["(no authoritative rooms yet)"];
  }

  const teamLabelsByRoom = new Map<string, string[]>();
  for (const team of teams) {
    if (!team.roomId) {
      continue;
    }
    const labels = teamLabelsByRoom.get(team.roomId) ?? [];
    labels.push(formatTeamLabel(team.id));
    teamLabelsByRoom.set(team.roomId, labels);
  }

  const entityLabelsByRoom = new Map<string, string[]>();
  for (const entity of entities) {
    const roomId = entity.roomId ?? "unplaced";
    const labels = entityLabelsByRoom.get(roomId) ?? [];
    labels.push(formatEntityLabel(entity.id));
    entityLabelsByRoom.set(roomId, labels);
  }

  return rooms.flatMap((room) => {
    const teamsInRoom = unique(teamLabelsByRoom.get(room.id) ?? []).sort();
    const entitiesInRoom = unique(entityLabelsByRoom.get(room.id) ?? []).sort();
    const occupants = entitiesInRoom.length > 0 ? entitiesInRoom.join(", ") : "empty";
    const label = room.label?.trim() || room.id;
    const summary = [
      teamsInRoom.length > 0 ? `teams=${teamsInRoom.join(", ")}` : null,
      `occupants=${entitiesInRoom.length}`,
    ]
      .filter((value): value is string => value !== null)
      .join(" ");

    return [
      `|-- ${room.id} (${label}) ${summary}`,
      `|   \`-- ${occupants}`,
    ];
  });
};

const buildMemberLine = ({
  entityId,
  roomId,
  directAction,
  teamAction,
  isLast,
}: {
  entityId: string;
  roomId: string;
  directAction: DescribedEvent | undefined;
  teamAction: DescribedEvent | undefined;
  isLast: boolean;
}): string => {
  const branch = isLast ? "`--" : "|--";
  const action = directAction ?? teamAction;
  const actionLabel = action
    ? `${action.summary} @ ${action.timestampLabel}`
    : ASCII_IDLE_LABEL;

  return `|   ${branch} ${formatEntityLabel(entityId)} [${roomId}] last: ${actionLabel}`;
};

const renderTeams = ({
  teams,
  entityRoomMap,
  latestMemberActivityById,
  latestTeamActivityById,
  teamTrailById,
}: {
  teams: NonNullable<OpenClawAsciiOverviewReadModel["world"]>["teams"];
  entityRoomMap: Map<string, string>;
  latestMemberActivityById: Map<string, DescribedEvent>;
  latestTeamActivityById: Map<string, DescribedEvent>;
  teamTrailById: Map<string, DescribedEvent[]>;
}): string[] => {
  if (teams.length === 0) {
    return ["(no authoritative teams yet)"];
  }

  return [...teams]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((team) => {
      const roomId = team.roomId ?? "unplaced";
      const teamTrail = teamTrailById.get(team.id) ?? [];
      const lines = [`|-- ${formatTeamLabel(team.id)} @ ${roomId}`];

      if (team.memberIds.length === 0) {
        lines.push("|   `-- no members");
      } else {
        team.memberIds.forEach((memberId, index) => {
          lines.push(
            buildMemberLine({
              entityId: memberId,
              roomId: entityRoomMap.get(memberId) ?? "unplaced",
              directAction: latestMemberActivityById.get(memberId),
              teamAction: latestTeamActivityById.get(team.id),
              isLast: index === team.memberIds.length - 1,
            }),
          );
        });
      }

      lines.push(
        `|   trail: ${teamTrail.length > 0 ? teamTrail.map((entry) => `${entry.summary} @ ${entry.timestampLabel}`).join(" | ") : ASCII_IDLE_LABEL}`,
      );
      return lines;
    });
};

const renderUnassigned = ({
  entities,
  entityTeamMap,
  latestTargetedEntityActivityById,
}: {
  entities: NonNullable<OpenClawAsciiOverviewReadModel["world"]>["entities"];
  entityTeamMap: Map<string, string>;
  latestTargetedEntityActivityById: Map<string, DescribedEvent>;
}): string[] => {
  const unassignedEntities = [...entities]
    .filter((entity) => !entityTeamMap.has(entity.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (unassignedEntities.length === 0) {
    return ["(none)"];
  }

  return unassignedEntities.map((entity, index) => {
    const directAction = latestTargetedEntityActivityById.get(entity.id);
    return `${index === unassignedEntities.length - 1 ? "`--" : "|--"} ${formatEntityLabel(entity.id)} [${entity.roomId ?? "unplaced"}] last: ${directAction ? `${directAction.summary} @ ${directAction.timestampLabel}` : ASCII_IDLE_LABEL}`;
  });
};

const renderTimers = (timers: GatewayTimerSnapshot[]): string[] => {
  if (timers.length === 0) {
    return ["(no authoritative timers yet)"];
  }

  return [...timers]
    .sort((left, right) => (left.stageId ?? left.id).localeCompare(right.stageId ?? right.id))
    .map(
      (timer) =>
        `|-- ${timer.id} stage=${timer.stageId ?? "unknown"} state=${timer.state} remaining=${formatDurationLabel(timer.remainingMs)}`,
    );
};

const renderSubmissions = (
  submissions: GatewaySubmissionSnapshot[],
): string[] => {
  if (submissions.length === 0) {
    return ["(no authoritative submissions yet)"];
  }

  return [...submissions]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((submission) => {
      const state = submission.locked ? "locked" : "open";
      const version = submission.version ?? submission.versions?.at(-1)?.version ?? 0;
      return [
        `|-- ${submission.id} [${submission.schemaId}] team=${submission.teamId ?? "n/a"} stage=${submission.stageId ?? "n/a"} state=${state} version=v${version}`,
        `|   opened=${formatClockLabel(submission.openedAt)} updated=${formatClockLabel(submission.updatedAt)} locked=${formatClockLabel(submission.lockedAt)}`,
      ];
    });
};

const renderScoreSummary = (
  scoreSummary: GatewayScoreSummarySnapshot[],
): string[] => {
  if (scoreSummary.length === 0) {
    return ["(no authoritative scores yet)"];
  }

  return [...scoreSummary]
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) {
        return right.averageScore - left.averageScore;
      }
      return left.targetId.localeCompare(right.targetId);
    })
    .map(
      (summary) =>
        `|-- ${summary.submissionId ?? summary.targetId} team=${summary.teamId ?? "n/a"} judges=${summary.judgeCount} avg=${summary.averageScore.toFixed(2)} total=${summary.totalScore} last=${formatClockLabel(summary.lastSubmittedAt)}`,
    );
};

const renderAwards = (
  awards: NonNullable<OpenClawAsciiOverviewReadModel["awards"]>,
): string[] => {
  if (awards.length === 0) {
    return ["(no authoritative awards yet)"];
  }

  return awards.map(
    (award) =>
      `|-- ${award.awardId ?? "award"} label=${award.label ?? "award"} entity=${award.entityId ?? "n/a"} at=${formatClockLabel(award.grantedAt)} reason=${award.reason ?? "n/a"}`,
  );
};

const renderSocialSnapshot = (
  social: OpenClawAsciiOverviewReadModel["social"],
): string[] => {
  if (!social) {
    return ["(no authoritative social snapshot yet)"];
  }

  const lines: string[] = [];
  const pushBucket = (title: string, content: string[]) => {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(title);
    lines.push(...content);
  };

  pushBucket(
    "audience_heat",
    social.audienceHeat.length > 0
      ? [...social.audienceHeat]
          .sort((left, right) => {
            if (right.value !== left.value) {
              return right.value - left.value;
            }
            return `${left.scope}:${left.targetId}`.localeCompare(
              `${right.scope}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.scope}:${entry.targetId} value=${entry.value} last=${formatClockLabel(entry.lastUpdatedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "bet_heat",
    social.betHeat.length > 0
      ? [...social.betHeat]
          .sort((left, right) => {
            if (right.value !== left.value) {
              return right.value - left.value;
            }
            return `${left.scope}:${left.targetId}`.localeCompare(
              `${right.scope}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.scope}:${entry.targetId} value=${entry.value} last=${formatClockLabel(entry.lastUpdatedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "reaction_totals",
    social.reactionTotals.length > 0
      ? [...social.reactionTotals]
          .sort((left, right) => {
            if (right.total !== left.total) {
              return right.total - left.total;
            }
            return `${left.scope}:${left.targetId}`.localeCompare(
              `${right.scope}:${right.targetId}`,
            );
          })
          .map((entry) => {
            const reactions = Object.entries(entry.reactions)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([reaction, total]) => `${reaction}=${total}`)
              .join(" ");
            return `|-- ${entry.scope}:${entry.targetId} total=${entry.total}${reactions ? ` ${reactions}` : ""} last=${formatClockLabel(entry.lastUpdatedAt)}`;
          })
      : ["(none)"],
  );

  pushBucket(
    "bet_summary",
    social.betSummary.length > 0
      ? [...social.betSummary]
          .sort((left, right) => {
            if (right.totalAmount !== left.totalAmount) {
              return right.totalAmount - left.totalAmount;
            }
            return `${left.targetType}:${left.targetId}`.localeCompare(
              `${right.targetType}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.targetType}:${entry.targetId} count=${entry.count} total=${entry.totalAmount} last=${formatClockLabel(entry.lastPlacedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "vote_summary",
    social.voteSummary.length > 0
      ? [...social.voteSummary]
          .sort((left, right) => {
            if (right.totalValue !== left.totalValue) {
              return right.totalValue - left.totalValue;
            }
            return `${left.targetType}:${left.targetId}`.localeCompare(
              `${right.targetType}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.targetType}:${entry.targetId} count=${entry.count} total=${entry.totalValue} avg=${entry.averageValue.toFixed(2)} last=${formatClockLabel(entry.lastSubmittedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "bet_settlements",
    social.betSettlements.length > 0
      ? [...social.betSettlements]
          .sort((left, right) => right.settledAt - left.settledAt)
          .map((entry) => {
            const payout =
              typeof entry.payout === "number" && Number.isFinite(entry.payout)
                ? ` payout=${entry.payout}`
                : "";
            return `|-- ${entry.actorId} ${entry.targetType}:${entry.targetId} -> ${entry.result}${payout} at=${formatClockLabel(entry.settledAt)}`;
          })
      : ["(none)"],
  );

  return lines;
};

const renderRunCapsule = (
  readModel: OpenClawAsciiOverviewReadModel,
): string[] => {
  const lastEvent = readModel.historyEvents[0];
  return [
    `run=${readModel.activityRun?.id ?? "unknown-run"} template=${readModel.activityRun?.templateId ?? "unknown-template"}`,
    `status=${readModel.activityRun?.status ?? "unknown"} stage=${formatStageLabel(readModel.activityRun?.currentStageId ?? null, readModel.currentStageTemplate)} sequence=${readModel.lastSequence}`,
    `health=${formatDateTimeLabel(readModel.healthTimestamp)} updated=${formatDateTimeLabel(readModel.now)} replay=${readModel.replayEventCount}`,
    lastEvent
      ? `last_event=#${String(lastEvent.sequence).padStart(4, "0")} ${lastEvent.timestampLabel} ${lastEvent.actorId ?? "system"} :: ${lastEvent.summary}`
      : "last_event=(none)",
  ];
};

const renderActCheckpoints = (
  checkpoints: OpenClawAsciiOverviewReadModel["actCheckpoints"],
): string[] =>
  checkpoints.map((checkpoint) => {
    const marker =
      checkpoint.status === "done"
        ? "[x]"
        : checkpoint.status === "active"
          ? "[>]"
          : "[ ]";
    return `${marker} ${checkpoint.stageId} (${checkpoint.title}) :: ${checkpoint.summary}`;
  });

const renderPendingObligations = (
  obligations: OpenClawAsciiOverviewReadModel["pendingObligations"],
): string[] =>
  obligations.map((entry, index) => `${index + 1}. ${entry}`);

const renderFullRunSummary = (
  summary: OpenClawAsciiOverviewReadModel["fullRunSummary"],
): string[] => [
  `talks=${summary.talkCount} broadcasts=${summary.broadcastCount} reactions=${summary.reactionCount}`,
  `bets=${summary.betCount} votes=${summary.voteCount} settlements=${summary.settlementCount}`,
  `submissions=${summary.submissionCount} locked=${summary.lockedSubmissionCount} scores=${summary.scoreCount} awards=${summary.awardCount}`,
];

const renderCloseoutCapsule = (
  readModel: OpenClawAsciiOverviewReadModel,
): string[] => {
  const lines = [...readModel.closeoutCapsule.lines];
  if (readModel.runOutcome.endedAt) {
    lines.push(`ended_at=${formatDateTimeLabel(readModel.runOutcome.endedAt)}`);
  }
  return lines.length > 0 ? lines : ["closeout not reached yet"];
};

const renderEventFeed = ({
  events,
  eventLimit,
  emptyLabel,
}: {
  events: DescribedEvent[];
  eventLimit: number;
  emptyLabel: string;
}): string[] => {
  if (events.length === 0) {
    return [emptyLabel];
  }

  return events.slice(0, eventLimit).map((entry) => {
    const actorLabel = entry.actorId ?? "system";
    return `#${String(entry.sequence).padStart(4, "0")} ${entry.timestampLabel} ${actorLabel} :: ${entry.summary}`;
  });
};

export const renderOpenClawAsciiOverview = (
  readModel: OpenClawAsciiOverviewReadModel,
): string => {
  const lines = [
    "THE FOOL AUTHORITATIVE ASCII WATCH",
    "==================================",
    `events   : showing ${Math.min(readModel.resolvedEventLimit, readModel.recentEventCount)} of ${readModel.recentEventCount} recent authoritative events`,
    `replay   : ${readModel.replayEventCount} historical authoritative events loaded`,
  ];

  renderSection(lines, "RUN CAPSULE", renderRunCapsule(readModel));
  renderSection(lines, "ACT CHECKPOINTS", renderActCheckpoints(readModel.actCheckpoints));
  renderSection(
    lines,
    "PENDING OBLIGATIONS",
    renderPendingObligations(readModel.pendingObligations),
  );
  renderSection(lines, "FULL-RUN SUMMARY", renderFullRunSummary(readModel.fullRunSummary));
  renderSection(lines, "CLOSEOUT CAPSULE", renderCloseoutCapsule(readModel));

  renderSection(
    lines,
    "STAGE LADDER",
    renderStageLadder({
      stageTemplates: readModel.stageTemplates,
      currentStageId: readModel.activityRun?.currentStageId ?? null,
      stageHistory: readModel.stageHistory,
    }),
  );

  renderSection(
    lines,
    "ROOMS",
    readModel.world
      ? renderRooms(readModel.world)
      : ["(authority world unavailable)"],
  );

  renderSection(
    lines,
    "TEAMS",
    readModel.world
      ? renderTeams({
          teams: readModel.world.teams,
          entityRoomMap: readModel.entityRoomMap,
          latestMemberActivityById: readModel.latestMemberActivityById,
          latestTeamActivityById: readModel.latestTeamActivityById,
          teamTrailById: readModel.teamTrailById,
        })
      : ["(authority world unavailable)"],
  );

  renderSection(
    lines,
    "UNASSIGNED",
    readModel.world
      ? renderUnassigned({
          entities: readModel.world.entities,
          entityTeamMap: readModel.entityTeamMap,
          latestTargetedEntityActivityById:
            readModel.latestTargetedEntityActivityById,
        })
      : ["(authority world unavailable)"],
  );

  renderSection(lines, "TIMERS", renderTimers(readModel.timers));
  renderSection(lines, "SUBMISSIONS", renderSubmissions(readModel.submissions));
  renderSection(lines, "SCOREBOARD", renderScoreSummary(readModel.scoreSummary));
  renderSection(lines, "AWARDS", renderAwards(readModel.awards));
  renderSection(
    lines,
    "SOCIAL SNAPSHOT",
    renderSocialSnapshot(readModel.social),
  );
  renderSection(
    lines,
    "LIVE SOCIAL",
    renderEventFeed({
      events: readModel.socialEvents,
      eventLimit: readModel.resolvedEventLimit,
      emptyLabel: "(no authoritative social events yet)",
    }),
  );
  renderSection(
    lines,
    "RECENT AUTHORITATIVE EVENTS",
    renderEventFeed({
      events: readModel.historyEvents,
      eventLimit: readModel.resolvedEventLimit,
      emptyLabel: "(no events)",
    }),
  );

  return lines.join("\n");
};
