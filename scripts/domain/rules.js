export function squadCapacity(intelligenceModifier) {
  return Math.max(0, 2 + Number(intelligenceModifier || 0));
}

export function preparedCapacity({ level, commander = true, efficientPreparation = false, tacticalExcellence = 0 }) {
  const numericLevel = Number(level || 0);
  const commanderSlots = commander ? (numericLevel >= 19 ? 6 : numericLevel >= 15 ? 5 : numericLevel >= 7 ? 4 : 3) : 1;
  return commanderSlots + (efficientPreparation ? 1 : 0) + Math.max(0, Number(tacticalExcellence || 0));
}

export function combatRoundKey(combat) {
  return combat ? `${combat.id}:${combat.round ?? 0}` : `world:${Math.floor(Date.now() / 6000)}`;
}

export function responseAllowed(previousRoundKey, currentRoundKey) {
  return !previousRoundKey || previousRoundKey !== currentRoundKey;
}

export function selectionAllowed(selection, selectedCount, eligibleCount) {
  if (selectedCount < 1) return false;
  if (selection === "all") return selectedCount === eligibleCount;
  if (selection === "one") return selectedCount === 1;
  if (selection === "two") return selectedCount === 2;
  if (selection === "up-to-2") return selectedCount <= 2;
  if (selection === "up-to-3") return selectedCount <= 3;
  return true;
}
