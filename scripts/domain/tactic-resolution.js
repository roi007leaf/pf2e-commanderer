export function resolutionGeometryVerdict({
  targetParticipantDistances = [],
  targetCommanderDistances = [],
  participantPairDistances = [],
  maxTargets = null,
  minParticipants = 0,
  geometry = {},
  gridDistance = 5,
} = {}) {
  const targetCount = targetParticipantDistances.length;
  const participantCount = targetParticipantDistances[0]?.length ?? 0;
  if (Number.isFinite(maxTargets) && targetCount > maxTargets) {
    return { valid: false, code: "too-many-targets", message: `Target no more than ${maxTargets} affected creature${maxTargets === 1 ? "" : "s"}.` };
  }
  if (participantCount < minParticipants) {
    return { valid: false, code: "too-few-responders", message: `At least ${minParticipants} squadmates must complete the tactic before resolution.` };
  }
  if ((geometry.withinAny || geometry.adjacentToAll) && participantCount === 0) {
    return { valid: false, code: "no-responders", message: "At least one squadmate must complete the tactic before resolution." };
  }
  if (geometry.pairwiseWithin && participantPairDistances.some((distance) => distance > geometry.pairwiseWithin)) {
    return {
      valid: false,
      code: "formation-too-wide",
      message: `Every participating squadmate must finish within ${geometry.pairwiseWithin} feet of every other participant.`,
    };
  }
  for (let targetIndex = 0; targetIndex < targetParticipantDistances.length; targetIndex += 1) {
    const distances = targetParticipantDistances[targetIndex];
    if (geometry.withinAny && !distances.some((distance) => distance <= geometry.withinAny)) {
      return {
        valid: false,
        code: "outside-area",
        targetIndex,
        message: `Every target must be within ${geometry.withinAny} feet of a squadmate who responded.`,
      };
    }
    if (geometry.adjacentToAll && distances.some((distance) => distance > gridDistance)) {
      return {
        valid: false,
        code: "not-adjacent-to-all",
        targetIndex,
        message: "The target must be adjacent to every squadmate who responded.",
      };
    }
    if (geometry.withinCommander && Number(targetCommanderDistances[targetIndex]) > geometry.withinCommander) {
      return {
        valid: false,
        code: "outside-commander-range",
        targetIndex,
        message: `Every target must be within ${geometry.withinCommander} feet of the commander.`,
      };
    }
  }
  return { valid: true, code: "valid", message: "Target geometry is valid." };
}
