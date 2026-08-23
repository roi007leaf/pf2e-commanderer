const GENERIC_TRAITS = new Set(["commander", "tactic"]);
const CATEGORY_DESCRIPTIONS = {
  "commander-mobility-tactic": "Mobility tactics make it easier for your party to move across the battlefield or negotiate unusual terrain.",
  "commander-offensive-tactic": "Offensive tactics help you attack enemies, control enemy positioning, or endure enemy attacks.",
};

function titleCase(slug) {
  return String(slug ?? "")
    .replace(/^commander-/, "")
    .replace(/-tactic$/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function actionLabel(item) {
  const type = item.system?.actionType?.value;
  const count = Number(item.system?.actions?.value ?? 0);
  if (type === "reaction") return "Reaction";
  if (type === "free") return "Free action";
  if (count === 1) return "1 action";
  if (count > 1) return `${count} actions`;
  return "Tactic";
}

function tacticTags(item, traitDescriptions = {}) {
  const category = item.system?.traits?.otherTags
    ?.find((slug) => /^commander-.+-tactic$/.test(slug));
  const traits = item.system?.traits?.value ?? [];
  return [category, ...traits]
    .filter((slug) => slug && !GENERIC_TRAITS.has(slug))
    .map((slug) => ({
      label: titleCase(slug),
      description: CATEGORY_DESCRIPTIONS[slug] ?? traitDescriptions[slug] ?? null,
    }))
    .filter((tag, index, tags) => tag.label && tags.findIndex((candidate) => candidate.label === tag.label) === index);
}

function frequencyLabel(item) {
  const frequency = item.system?.frequency;
  if (!frequency) return null;
  const value = Number(frequency.value ?? 0);
  const max = Number(frequency.max ?? 0);
  return max > 0 ? `${value}/${max} uses` : null;
}

/**
 * The panel's stable interface for a PF2e tactic Item.
 * Foundry-specific enrichment happens outside this module and is injected here.
 */
export function tacticViewModel(item, {
  prepared = false,
  expanded = false,
  description = "",
  audience = null,
  traitDescriptions = {},
} = {}) {
  const level = Number(item.system?.level?.value ?? 0);
  const eligible = (audience?.eligibleCount ?? 1) > 0;
  return {
    id: item.id,
    name: item.name,
    img: item.img,
    prepared,
    expanded,
    description,
    actionLabel: actionLabel(item),
    frequencyLabel: frequencyLabel(item),
    levelLabel: level > 0 ? `Level ${level}` : null,
    tags: tacticTags(item, traitDescriptions),
    audience,
    canIssue: prepared && eligible,
    issueTitle: !prepared
      ? "Prepare this tactic before issuing it"
      : eligible ? `Issue ${item.name}` : "No squadmates currently meet this tactic's signal reach",
  };
}
