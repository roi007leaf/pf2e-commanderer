import {
  bannerCarrierToken,
  canRetrieveBanner,
  plantedBanner,
  retrieveBanner,
  sceneBannerPlacements,
} from "./banner.js";
import { formFromDialogSubmit } from "./dialog.js";
import { notify } from "./runtime.js";
import { registerOperation, requestOperation } from "./socket.js";

export const RULE_BANNER_RECOVERY_OPERATION = "rule-banner-recovery";
export const ROLL_BANNER_RECOVERY_OPERATION = "roll-banner-recovery";
export const RESOLVE_BANNER_RECOVERY_OPERATION = "resolve-banner-recovery";

const RULING_TIMEOUT_MS = 120_000;
const RULING_LIFETIME_MS = 5 * 60_000;
const pendingRulings = new Map();
let recoveryRegistered = false;

const CORE_SKILLS = [
  ["acrobatics", "Acrobatics"],
  ["arcana", "Arcana"],
  ["athletics", "Athletics"],
  ["crafting", "Crafting"],
  ["deception", "Deception"],
  ["diplomacy", "Diplomacy"],
  ["intimidation", "Intimidation"],
  ["medicine", "Medicine"],
  ["nature", "Nature"],
  ["occultism", "Occultism"],
  ["performance", "Performance"],
  ["religion", "Religion"],
  ["society", "Society"],
  ["stealth", "Stealth"],
  ["survival", "Survival"],
  ["thievery", "Thievery"],
];

function escapeHTML(value) {
  return globalThis.foundry?.utils?.escapeHTML?.(String(value ?? "")) ?? String(value ?? "");
}

function activeGM() {
  return globalThis.game?.users?.activeGM
    ?? globalThis.game?.users?.find?.((user) => user.active && user.isGM)
    ?? null;
}

function activeUsers() {
  const users = globalThis.game?.users;
  if (Array.isArray(users?.contents)) return users.contents.filter((user) => user.active);
  if (Array.isArray(users)) return users.filter((user) => user.active);
  return [];
}

export function bannerRecoveryRollerChoices(commander, requestingUserId = null) {
  const playerOwners = activeUsers()
    .filter((user) => !user.isGM && commander?.testUserPermission?.(user, "OWNER") === true)
    .map((user) => ({ id: user.id, name: user.name, isGM: false }));
  const gm = activeGM();
  const choices = [...playerOwners];
  if (gm) choices.push({ id: gm.id, name: gm.name, isGM: true });
  const defaultUserId = playerOwners.find((user) => user.id === requestingUserId)?.id
    ?? playerOwners[0]?.id
    ?? gm?.id
    ?? null;
  return { choices, defaultUserId };
}

function uniqueStatistics(statistics) {
  const unique = new Map();
  for (const statistic of statistics) {
    if (!statistic?.slug || typeof statistic.roll !== "function") continue;
    unique.set(statistic.slug, {
      slug: statistic.slug,
      label: statistic.label ?? statistic.slug,
      modifier: Number(statistic.mod ?? statistic.check?.mod ?? 0),
    });
  }
  return [...unique.values()].sort((left, right) => {
    if (left.slug === "athletics") return -1;
    if (right.slug === "athletics") return 1;
    return left.label.localeCompare(right.label);
  });
}

export function bannerRecoveryCheckChoices(actor) {
  const prepared = Object.values(actor?.skills ?? {});
  for (const [slug] of CORE_SKILLS) {
    const statistic = actor?.getStatistic?.(slug);
    if (statistic) prepared.push(statistic);
  }
  const perception = actor?.getStatistic?.("perception") ?? actor?.perception;
  if (perception) prepared.push(perception);
  return uniqueStatistics(prepared);
}

export function bannerRecoveryDcChoices(actor) {
  const definitions = [
    ["reflex", "Reflex DC"],
    ["fortitude", "Fortitude DC"],
    ["will", "Will DC"],
    ["perception", "Perception DC"],
    ["ac", "Armor Class"],
  ];
  return definitions.flatMap(([slug, label]) => {
    const statistic = actor?.getStatistic?.(slug)
      ?? actor?.saves?.[slug]
      ?? (slug === "perception" ? actor?.perception : null)
      ?? (slug === "ac" ? actor?.armorClass : null);
    const value = Number(statistic?.dc?.value ?? statistic?.value);
    return Number.isFinite(value) ? [{ slug, label, value }] : [];
  });
}

function selectedOption(form, name) {
  return form.elements[name]?.value ?? "";
}

export function bannerRecoveryRuling(selection, checks, dcs) {
  const method = selection.method;
  const customDc = Number(selection.customDc);
  const customStatistic = selection.statistic;
  const customDcSlug = selection.dcSource;
  const presets = {
    disarm: { action: "Disarm", actionSlug: "disarm", statistic: "athletics", dcSlug: "reflex" },
    grapple: { action: "Grapple", actionSlug: "grapple", statistic: "athletics", dcSlug: "fortitude" },
    athletics: { action: "Athletics", actionSlug: "retrieve-banner", statistic: "athletics", dc: customDc },
    custom: { action: "GM ruling", actionSlug: "retrieve-banner", statistic: customStatistic, dcSlug: customDcSlug },
  };
  const selected = presets[method] ?? presets.custom;
  const check = checks.find((choice) => choice.slug === selected.statistic);
  if (!check) throw new Error("Choose a statistic the Commander can roll.");
  const dcChoice = dcs.find((choice) => choice.slug === selected.dcSlug);
  const dc = Number(dcChoice?.value ?? selected.dc ?? customDc);
  if (!Number.isFinite(dc) || dc < 1) throw new Error("Choose a valid DC.");
  return {
    mode: "roll",
    action: selected.action,
    actionSlug: selected.actionSlug,
    statistic: check.slug,
    statisticLabel: check.label,
    dc,
    dcSlug: dcChoice?.slug ?? null,
    dcLabel: dcChoice?.label ?? `DC ${dc}`,
  };
}

function rulingFromForm(form, checks, dcs) {
  return {
    ...bannerRecoveryRuling({
      method: selectedOption(form, "method"),
      customDc: selectedOption(form, "customDc"),
      statistic: selectedOption(form, "statistic"),
      dcSource: selectedOption(form, "dcSource"),
    }, checks, dcs),
    rollerUserId: selectedOption(form, "roller"),
  };
}

function approachCard({ value, icon, title, detail, disabled = false, checked = false }) {
  return `<label class="commanderer-recovery-approach${disabled ? " disabled" : ""}">
    <input type="radio" name="method" value="${value}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
    <i class="fa-solid ${icon}"></i>
    <span><strong>${title}</strong><small>${detail}</small></span>
    <span class="commanderer-choice-indicator"><i class="fa-solid fa-check"></i></span>
  </label>`;
}

export async function chooseBannerRecoveryRuling(commander, carrier, { rollers = [], defaultRollerUserId = null } = {}) {
  const checks = bannerRecoveryCheckChoices(commander);
  const dcs = bannerRecoveryDcChoices(carrier?.actor);
  if (!checks.length) throw new Error(`${commander.name} has no statistic available for this check.`);
  const reflex = dcs.find((choice) => choice.slug === "reflex");
  const fortitude = dcs.find((choice) => choice.slug === "fortitude");
  const defaultDc = reflex?.value ?? fortitude?.value ?? 15;
  const checkOptions = checks.map((choice) => `<option value="${escapeHTML(choice.slug)}" ${choice.slug === "athletics" ? "selected" : ""}>${escapeHTML(choice.label)} (${choice.modifier >= 0 ? "+" : ""}${choice.modifier})</option>`).join("");
  const dcOptions = dcs.map((choice) => `<option value="${escapeHTML(choice.slug)}">${escapeHTML(choice.label)} ${choice.value}</option>`).join("");
  const rollerOptions = rollers.map((user) => `<option value="${escapeHTML(user.id)}" ${user.id === defaultRollerUserId ? "selected" : ""}>${escapeHTML(user.name)}${user.isGM ? " (GM)" : ""}</option>`).join("");
  const cards = [
    approachCard({
      value: "disarm",
      icon: "fa-hand",
      title: "Disarm",
      detail: reflex ? `Athletics vs Reflex DC ${reflex.value}` : "Reflex DC unavailable",
      disabled: !reflex,
      checked: Boolean(reflex),
    }),
    approachCard({
      value: "grapple",
      icon: "fa-hand-fist",
      title: "Grapple",
      detail: fortitude ? `Athletics vs Fortitude DC ${fortitude.value}` : "Fortitude DC unavailable",
      disabled: !fortitude,
      checked: !reflex && Boolean(fortitude),
    }),
    approachCard({
      value: "athletics",
      icon: "fa-dumbbell",
      title: "Athletics",
      detail: "Athletics vs GM-set DC",
      checked: !reflex && !fortitude,
    }),
    approachCard({
      value: "custom",
      icon: "fa-scale-balanced",
      title: "Custom ruling",
      detail: "Choose any check and defense",
    }),
  ].join("");

  return foundry.applications.api.DialogV2.wait({
    window: { title: `Rule ${commander.name}'s Banner Retrieval`, icon: "fa-solid fa-scale-balanced" },
    classes: ["pf2e-commanderer-recovery-dialog"],
    modal: true,
    rejectClose: false,
    content: `<div class="pf2e-commanderer-dialog commander-banner-recovery-dialog">
      <div class="commanderer-recovery-summary">
        <img src="${escapeHTML(commander.img)}" alt="${escapeHTML(commander.name)}">
        <i class="fa-solid fa-arrow-right-arrow-left"></i>
        <img src="${escapeHTML(carrier?.actor?.img)}" alt="${escapeHTML(carrier?.actor?.name)}">
        <div><strong>${escapeHTML(commander.name)} attempts to recover the banner</strong><small>${escapeHTML(carrier?.actor?.name)} currently carries it. Choose the ruling; the Commander owner makes the roll.</small></div>
      </div>
      <fieldset class="commanderer-recovery-fieldset">
        <legend>Approach</legend>
        <div class="commanderer-recovery-approaches">${cards}</div>
      </fieldset>
      <fieldset class="commanderer-recovery-fieldset commander-recovery-custom">
        <legend>GM controls</legend>
        <div class="form-group"><label>Rolling player</label><select name="roller">${rollerOptions}</select></div>
        <div class="form-group"><label>Commander check</label><select name="statistic">${checkOptions}</select></div>
        <div class="form-group"><label>Opposition</label><select name="dcSource">${dcOptions}<option value="custom">Custom DC</option></select></div>
        <div class="form-group"><label>GM-set DC</label><input type="number" name="customDc" value="${defaultDc}" min="1" step="1"></div>
        <p class="hint">Disarm and Grapple use their listed presets. Athletics uses GM-set DC. Custom ruling uses both selectors.</p>
      </fieldset>
    </div>`,
    buttons: [{
      action: "roll",
      label: "Request Commander Roll",
      icon: "fa-solid fa-dice-d20",
      default: true,
      callback: (_event, button, dialog) => rulingFromForm(formFromDialogSubmit(button, dialog), checks, dcs),
    }, {
      action: "manual",
      label: "Retrieve Manually",
      icon: "fa-solid fa-user-shield",
      callback: () => ({ mode: "manual" }),
    }, {
      action: "cancel",
      label: "Cancel",
      icon: "fa-solid fa-xmark",
      callback: () => null,
    }],
  });
}

function recoveryContext(payload, userId) {
  const scene = globalThis.game?.scenes?.get?.(payload.sceneId);
  const user = globalThis.game?.users?.get?.(userId);
  const placement = sceneBannerPlacements(scene)[payload.commanderActorId];
  const commander = globalThis.game?.actors?.get?.(payload.commanderActorId)
    ?? globalThis.fromUuidSync?.(placement?.actorUuid)
    ?? null;
  if (!scene || !user || !commander || placement?.actorUuid !== commander.uuid) {
    throw new Error("Banner recovery request is no longer valid.");
  }
  if (user.isGM !== true && commander.testUserPermission?.(user, "OWNER") !== true) {
    throw new Error("Only an owner of this Commander can request banner recovery.");
  }
  if (placement.removed !== true || placement.removalMode !== "carried") {
    throw new Error("This banner is no longer carried by an enemy.");
  }
  if (payload.carrierTokenUuid && placement.carrierTokenUuid !== payload.carrierTokenUuid) {
    throw new Error("The banner carrier has changed.");
  }
  const carrier = bannerCarrierToken(placement, scene);
  if (!carrier) throw new Error("The banner carrier is no longer on this scene.");
  if (!canRetrieveBanner(commander, scene)) {
    throw new Error(`Move adjacent to ${carrier.actor?.name ?? "the banner carrier"} before attempting recovery.`);
  }
  return { scene, user, placement, commander, carrier };
}

function prunePendingRulings() {
  const cutoff = Date.now() - RULING_LIFETIME_MS;
  for (const [id, ruling] of pendingRulings) {
    if (ruling.createdAt < cutoff) pendingRulings.delete(id);
  }
}

async function handleRecoveryRuling(payload, userId) {
  prunePendingRulings();
  const context = recoveryContext(payload, userId);
  const rollers = bannerRecoveryRollerChoices(context.commander, userId);
  if (!rollers.choices.length) throw new Error("No active Commander owner is available to make the recovery check.");
  const ruling = await chooseBannerRecoveryRuling(context.commander, context.carrier, {
    rollers: rollers.choices,
    defaultRollerUserId: rollers.defaultUserId,
  });
  if (!ruling) return null;
  if (ruling.mode === "manual") {
    const retrieved = await retrieveBanner(context.commander, context.scene, { allowCarried: true });
    return { mode: "manual", retrieved };
  }
  if (!rollers.choices.some((user) => user.id === ruling.rollerUserId)) {
    throw new Error("Choose an active Commander owner to make the recovery check.");
  }
  const rulingId = foundry.utils.randomID();
  pendingRulings.set(rulingId, {
    createdAt: Date.now(),
    userId,
    payload: {
      sceneId: context.scene.id,
      commanderActorId: context.commander.id,
      carrierTokenUuid: context.placement.carrierTokenUuid,
    },
  });
  return { ...ruling, rulingId };
}

async function handleRecoveryRoll(payload, userId) {
  const requester = globalThis.game?.users?.get?.(userId);
  if (globalThis.game?.user?.id !== payload.rollerUserId) {
    throw new Error("Banner recovery roll reached the wrong user.");
  }
  const context = recoveryContext(payload, payload.rollerUserId);
  if (requester?.isGM !== true && context.commander.testUserPermission?.(requester, "OWNER") !== true) {
    throw new Error("Only the GM or a Commander owner can request this recovery roll.");
  }
  notify("info", `${context.commander.name}: the GM requests a ${payload.ruling.action} check to recover the banner.`);
  const outcome = await rollBannerRecovery(context.commander, context.carrier, payload.ruling);
  return outcome ? { degreeOfSuccess: outcome.degreeOfSuccess, success: outcome.success } : null;
}

async function handleRecoveryResolution(payload, userId) {
  prunePendingRulings();
  const pending = pendingRulings.get(payload.rulingId);
  if (!pending || pending.userId !== userId) throw new Error("This banner recovery ruling has expired.");
  pendingRulings.delete(payload.rulingId);
  const degree = payload.degreeOfSuccess == null ? null : Number(payload.degreeOfSuccess);
  if (degree != null && (!Number.isInteger(degree) || degree < 0 || degree > 3)) {
    throw new Error("Banner recovery roll result is invalid.");
  }
  if (degree == null || degree < 2) return { retrieved: false, degreeOfSuccess: degree };
  const context = recoveryContext(pending.payload, userId);
  const retrieved = await retrieveBanner(context.commander, context.scene, { allowCarried: true });
  return { retrieved, degreeOfSuccess: degree };
}

export async function rollBannerRecovery(commander, carrier, ruling) {
  const statistic = commander?.getStatistic?.(ruling.statistic) ?? commander?.skills?.[ruling.statistic];
  if (typeof statistic?.roll !== "function") throw new Error(`${commander.name} cannot roll ${ruling.statisticLabel ?? ruling.statistic}.`);
  const roll = await statistic.roll({
    dc: { value: ruling.dc, slug: ruling.dcSlug ?? undefined },
    target: carrier?.actor ?? null,
    action: ruling.action,
    title: `${ruling.action}: Retrieve Banner`,
    extraRollOptions: [
      "action:retrieve-banner",
      ...(ruling.actionSlug && ruling.actionSlug !== "retrieve-banner" ? [`action:${ruling.actionSlug}`] : []),
    ],
  });
  if (!roll) return null;
  const degreeOfSuccess = Number(roll.degreeOfSuccess);
  if (!Number.isInteger(degreeOfSuccess)) throw new Error("PF2e did not return a degree of success for the recovery check.");
  return { roll, degreeOfSuccess, success: degreeOfSuccess >= 2 };
}

export async function recoverCarriedBanner(commander, scene = globalThis.canvas?.scene, {
  request = requestOperation,
  roll = rollBannerRecovery,
} = {}) {
  const placement = plantedBanner(commander, scene);
  if (!scene?.id || placement?.removalMode !== "carried") return false;
  if (!canRetrieveBanner(commander, scene)) {
    throw new Error(`Move adjacent to ${placement.removedBy?.actorName ?? "the banner carrier"} before attempting recovery.`);
  }
  if (!activeGM()) throw new Error("An active GM is required to rule banner recovery.");

  notify("info", "Waiting for the GM to rule the banner recovery check.");
  const ruling = await request(RULE_BANNER_RECOVERY_OPERATION, {
    sceneId: scene.id,
    commanderActorId: commander.id,
    carrierTokenUuid: placement.carrierTokenUuid,
  }, { gmRequired: true, timeoutMs: RULING_TIMEOUT_MS });
  if (!ruling) return false;
  if (ruling.mode === "manual") return ruling.retrieved === true;

  const carrier = bannerCarrierToken(plantedBanner(commander, scene), scene);
  if (!carrier) throw new Error("The banner carrier is no longer on this scene.");
  const outcome = ruling.rollerUserId && ruling.rollerUserId !== globalThis.game?.user?.id
    ? await request(ROLL_BANNER_RECOVERY_OPERATION, {
        sceneId: scene.id,
        commanderActorId: commander.id,
        carrierTokenUuid: placement.carrierTokenUuid,
        rollerUserId: ruling.rollerUserId,
        ruling,
      }, {
        authorityUserId: ruling.rollerUserId,
        directed: true,
        timeoutMs: RULING_TIMEOUT_MS,
      })
    : await roll(commander, carrier, ruling);
  const resolution = await request(RESOLVE_BANNER_RECOVERY_OPERATION, {
    rulingId: ruling.rulingId,
    degreeOfSuccess: outcome?.degreeOfSuccess ?? null,
  }, { gmRequired: true });
  if (resolution.retrieved) return true;
  if (outcome) notify("warn", `${ruling.action} failed. The enemy keeps the banner.`);
  return false;
}

export function registerBannerRecovery() {
  if (recoveryRegistered) return;
  recoveryRegistered = true;
  registerOperation(RULE_BANNER_RECOVERY_OPERATION, handleRecoveryRuling);
  registerOperation(ROLL_BANNER_RECOVERY_OPERATION, handleRecoveryRoll);
  registerOperation(RESOLVE_BANNER_RECOVERY_OPERATION, handleRecoveryResolution);
}
