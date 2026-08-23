const GENERIC_TRAITS = new Set(["commander", "tactic"]);

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

function tacticTags(item) {
  const category = item.system?.traits?.otherTags
    ?.find((slug) => /^commander-.+-tactic$/.test(slug));
  const traits = item.system?.traits?.value ?? [];
  return [category, ...traits]
    .filter((slug) => slug && !GENERIC_TRAITS.has(slug))
    .map(titleCase)
    .filter((label, index, labels) => label && labels.indexOf(label) === index);
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
export function tacticViewModel(item, { prepared = false, expanded = false, description = "", audience = null } = {}) {
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
    tags: tacticTags(item),
    audience,
    canIssue: prepared && eligible,
    issueTitle: !prepared
      ? "Prepare this tactic before issuing it"
      : eligible ? `Issue ${item.name}` : "No squadmates currently meet this tactic's signal reach",
  };
}
