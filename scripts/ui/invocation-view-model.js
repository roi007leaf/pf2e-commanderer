function titleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const INVOCATION_CARD_VERSION = 5;

export function invocationViewModel(invocation = {}) {
  const participants = (invocation.participants ?? []).map((participant, index) => {
    const status = ["responded", "declined"].includes(participant.status) ? participant.status : "pending";
    return {
      ...participant,
      index,
      status,
      pending: status === "pending",
      responded: status === "responded",
      declined: status === "declined",
      statusLabel: status === "responded"
        ? (participant.manual ? "Completed manually" : "Completed")
        : status === "declined" ? "Declined" : "Awaiting response",
      roleLabel: participant.role === "trip"
        ? "Trip setup"
        : participant.role === "spell" ? "Spell follow-up" : participant.role === "hide-sneak" ? "Free Hide or Sneak" : null,
    };
  });
  const answeredCount = participants.filter((participant) => !participant.pending).length;
  const resolvesDesignatedTarget = Boolean(invocation.designatedTarget && invocation.resolution?.maxTargets === 1);
  const pendingCount = participants.length - answeredCount;
  const hasResolution = Boolean(invocation.resolution) && !(invocation.resolutionResults?.length);

  return {
    ...invocation,
    cardVersion: INVOCATION_CARD_VERSION,
    hasResolution,
    workflowComplete: pendingCount === 0 && !hasResolution,
    workflowHint: pendingCount > 0
      ? "Each squadmate must Respond or Decline. If you already handled their action on the sheet, choose Manual to mark it complete."
      : hasResolution ? "Responses finished. The commander or a GM must resolve the affected targets below, or choose Handle manually."
        : "Workflow complete. Resolve any damage or table decisions described in the results.",
    participants,
    participantCount: participants.length,
    answeredCount,
    pendingCount: participants.length - answeredCount,
    allAnswered: participants.length > 0 && answeredCount === participants.length,
    signalLabel: `${titleCase(invocation.signal) || "Tactical"} signal`,
    responseTypeLabel: invocation.response?.reaction ? "Reaction" : "Response",
    resolveButtonLabel: resolvesDesignatedTarget ? `Resolve ${invocation.designatedTarget.name}` : "Resolve targeted creatures",
    resolveHint: resolvesDesignatedTarget
      ? "Uses the designated target shown above."
      : "Target only creatures actually affected after movement.",
    resolutionOverrideLabel: invocation.resolutionOverride?.mode === "geometry"
      ? `${invocation.resolutionOverride.userName ?? "The GM"} overrode formation and distance checks.`
      : invocation.resolutionOverride?.mode === "manual"
        ? `${invocation.resolutionOverride.userName ?? "A user"} handled resolution manually.`
        : null,
  };
}
