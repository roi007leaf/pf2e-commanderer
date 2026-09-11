// GM Core material statistics for thin objects; unusual materials use custom values.
export const BANNER_MATERIALS = Object.freeze({
  cloth: { label: "Cloth", hardness: 0, hp: 4 },
  leather: { label: "Thin leather", hardness: 2, hp: 8 },
  wood: { label: "Thin wood (pole)", hardness: 3, hp: 12 },
  steel: { label: "Thin iron or steel", hardness: 5, hp: 20 },
});

export function bannerObjectStats(actor, configuration = {}) {
  const material = BANNER_MATERIALS[configuration.material ?? "wood"];
  if (!material && configuration.material !== "custom") throw new Error("Choose a banner material.");
  let hardness = material?.hardness ?? Number(configuration.hardness);
  let hp = material?.hp ?? Number(configuration.hp);
  const item = configuration.itemId ? actor.items?.get?.(configuration.itemId) : null;
  if (configuration.itemId && !item) throw new Error("The affixed item is no longer in this commander's inventory.");
  if (item) {
    if (!["weapon", "shield", "equipment"].includes(item.type)) throw new Error("Choose a weapon, shield, or pole.");
    hardness = Math.max(hardness, Number(item.system?.hardness ?? 0));
    hp = Math.max(hp, Number(item.system?.hp?.max ?? 0));
  }
  const ac = Number(configuration.ac ?? 10);
  if (![hardness, hp, ac].every(Number.isInteger) || hardness < 0 || hp < 1 || ac < 0) {
    throw new Error("Hardness and AC must be nonnegative integers; HP must be a positive integer.");
  }
  const level = Number(actor.level ?? actor.system?.details?.level?.value ?? 1);
  const intelligence = Number(actor.abilities?.int?.mod ?? actor.system?.abilities?.int?.mod ?? 0);
  const bonus = item?.type === "shield" ? 0 : Math.max(0, level + intelligence);
  return { hardness, hp, ac, bonus, itemId: item?.id ?? null };
}
