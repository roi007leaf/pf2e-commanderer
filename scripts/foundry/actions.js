import { grantCompendiumEffect, grantPiranhaAssault, grantShadowsInMoonlight, grantWaitForIt } from "./effects.js";
import { formFromDialogSubmit } from "./dialog.js";
import { activeTokenFor, notify } from "./runtime.js";
import { performGatherMovement } from "./gather-movement.js";
import { performTacticMovement, requireTacticTarget } from "./tactic-movement.js";
import { requestOperation } from "./socket.js";

function actionBySlug(slug) {
  const collection = game.pf2e.actions;
  const camel = slug.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return collection?.get?.(slug) ?? collection?.[slug] ?? collection?.[camel] ?? null;
}

async function useAction(slug, actor) {
  const action = actionBySlug(slug);
  if (action?.use) return action.use({ actors: [actor] });
  if (typeof action === "function") return action({ actors: actor });
  throw new Error(`PF2e action '${slug}' is unavailable.`);
}

async function choose({ title, label, choices }) {
  if (choices.length === 1) return choices[0].value;
  const options = choices.map((choice) => `<option value="${choice.value}">${foundry.utils.escapeHTML(choice.label)}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `<div class="form-group"><label>${foundry.utils.escapeHTML(label)}</label><select name="choice">${options}</select></div>`,
    buttons: [
      {
        action: "ok",
        label: "Continue",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button, dialog) => formFromDialogSubmit(button, dialog).elements.choice.value,
      },
      { action: "cancel", label: "Cancel" },
    ],
    default: "ok",
  });
  return result === "cancel" ? null : result;
}

function strikeMatches(strike, mode = "any") {
  const item = strike.item;
  const melee = item?.isMelee ?? item?.system?.range == null;
  if (mode === "melee" && !melee) return false;
  if (mode === "ranged" && melee) return false;
  if (mode === "piercing-slashing-melee") {
    if (!melee) return false;
    const damageType = item?.system?.damage?.damageType ?? item?.system?.damage?.type;
    return ["piercing", "slashing"].includes(damageType);
  }
  return true;
}

async function rollStrike(actor, { mode = "any", title = "Commander Tactic" } = {}) {
  const strikes = (actor.system?.actions ?? [])
    .filter((action) => action.type === "strike" && action.visible !== false && strikeMatches(action, mode));
  if (!strikes.length) throw new Error(`${actor.name} has no available ${mode === "any" ? "" : `${mode} `}Strikes.`);
  const index = await choose({
    title,
    label: "Strike",
    choices: strikes.map((strike, strikeIndex) => ({ value: String(strikeIndex), label: strike.label ?? strike.item?.name ?? `Strike ${strikeIndex + 1}` })),
  });
  if (index == null) return null;
  await strikes[Number(index)].variants[0].roll({});
  return `rolled ${strikes[Number(index)].label ?? "a Strike"}`;
}

async function reload(actor, { optional = false } = {}) {
  const weapons = (actor.itemTypes?.weapon ?? []).filter((weapon) => {
    if (!weapon.isEquipped || weapon.system?.reload?.value == null) return false;
    const capacity = Number(weapon.system?.ammo?.capacity ?? 1);
    const loaded = (weapon.subitems ?? [])
      .filter((item) => item.isAmmoFor?.(weapon))
      .reduce((total, item) => total + Number(item.quantity ?? 0), 0);
    return loaded < capacity;
  });
  const ammunition = [
    ...(actor.itemTypes?.ammo ?? []),
    ...(actor.itemTypes?.weapon ?? []).filter((item) => item.system?.usage?.canBeAmmo),
  ].filter((item) => item.quantity > 0 && item.isStowed !== true && item.carryType !== "stowed");
  const choices = [];
  for (const weapon of weapons) {
    for (const ammo of ammunition.filter((item) => item.isAmmoFor?.(weapon))) {
      choices.push({ value: `${weapon.id}:${ammo.id}`, label: `${weapon.name} ← ${ammo.name}` });
    }
  }
  if (!choices.length) {
    if (optional) return "no reload needed";
    throw new Error(`${actor.name} has no held reloadable weapon with compatible accessible ammunition.`);
  }
  const selected = await choose({ title: "Reload!", label: "Weapon and ammunition", choices });
  if (!selected) return optional ? "reload skipped" : null;
  const [weaponId, ammoId] = selected.split(":");
  const weapon = actor.items.get(weaponId);
  const ammo = actor.items.get(ammoId);
  await weapon.attach(ammo, { quantity: 1, stack: true });
  return `reloaded ${weapon.name}`;
}

async function maneuverChoice(actor) {
  const slug = await choose({
    title: "Commander Tactic",
    label: "Maneuver",
    choices: ["grapple", "reposition", "shove", "trip"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
  });
  if (!slug) return "Maneuver cancelled";
  await useAction(slug, actor);
  return `used ${slug}`;
}

async function executeChoice(actor, step, title) {
  const choices = step.choices ?? [];
  const selected = await choose({
    title,
    label: step.label ?? "Granted action",
    choices: choices.map((choice, index) => ({ value: String(index), label: choice.label })),
  });
  if (selected == null) return null;
  const choice = choices[Number(selected)];
  if (choice.kind === "strike") return rollStrike(actor, { mode: choice.mode, title });
  await useAction(choice.slug, actor);
  return `used ${choice.label}`;
}

async function healActor(actor, amount) {
  const token = activeTokenFor(actor);
  if (!token || typeof actor.applyDamage !== "function") throw new Error(`${actor.name} needs a token to receive healing.`);
  await actor.applyDamage({ damage: -Number(amount), token: token.document ?? token, skipIWR: true });
  return `restored up to ${amount} HP`;
}

function actorsAreAllies(actor, other) {
  if (typeof actor?.isAllyOf === "function") return actor.isAllyOf(other);
  return actor?.alliance != null && actor.alliance === other?.alliance;
}

function movementPreventingCondition(actor) {
  return ["grabbed", "immobilized", "restrained"]
    .find((slug) => actor?.hasCondition?.(slug) || actor?.conditions?.has?.(slug));
}

function equalTokenFootprint(first, second) {
  return Number(first.width) === Number(second.width) && Number(first.height) === Number(second.height);
}

export async function swapTokenPositions({ movingTokenUuid, targetTokenUuid }, userId) {
  const [moving, target] = await Promise.all([fromUuid(movingTokenUuid), fromUuid(targetTokenUuid)]);
  if (!moving?.actor || !target?.actor || moving.documentName !== "Token" || target.documentName !== "Token") {
    throw new Error("Both Passage of Lines participants need tokens on the active scene.");
  }
  const user = game.users.get(userId);
  if (!user?.isGM && moving.actor.testUserPermission?.(user, "OWNER") !== true) {
    throw new Error(`You do not own ${moving.actor.name}.`);
  }
  if (!actorsAreAllies(moving.actor, target.actor)) throw new Error("Passage of Lines requires an allied target.");
  if (moving.parent?.uuid !== target.parent?.uuid || !moving.object || !target.object) {
    throw new Error("Both allies must be on the active scene.");
  }
  const prevented = movementPreventingCondition(moving.actor) ?? movementPreventingCondition(target.actor);
  if (prevented) throw new Error(`Passage of Lines cannot move an ally who is ${prevented}.`);
  const gridDistance = Number(moving.parent.grid?.distance ?? canvas.dimensions?.distance ?? 5);
  if (moving.object.distanceTo(target.object) > gridDistance) throw new Error("The willing ally must be adjacent.");
  if (!equalTokenFootprint(moving, target) || Number(moving.elevation) !== Number(target.elevation)) {
    throw new Error("Different-sized or vertically separated allies need the rule's manual placement choice.");
  }
  await moving.parent.updateEmbeddedDocuments("Token", [
    { _id: moving.id, x: target.x, y: target.y },
    { _id: target.id, x: moving.x, y: moving.y },
  ]);
  return `swapped positions with ${target.name}`;
}

async function performSwap(actor, tokenUuid) {
  const target = await requireTacticTarget(actor, "ally");
  const moving = tokenUuid ? await fromUuid(tokenUuid) : activeTokenFor(actor)?.document;
  if (!moving) throw new Error(`${actor.name} needs a token on the active scene.`);
  const confirmed = await foundry.applications.api.DialogV2.wait({
    window: { title: "Passage of Lines" },
    content: `<div class="pf2e-commanderer-dialog"><p>Exchange positions with <strong>${foundry.utils.escapeHTML(target.name)}</strong>?</p><p class="hint">Confirm that the adjacent ally is willing.</p></div>`,
    buttons: [
      { action: "swap", label: "Swap positions", icon: "fa-solid fa-people-arrows-left-right", default: true },
      { action: "cancel", label: "Cancel" },
    ],
    default: "swap",
  });
  if (confirmed !== "swap") return null;
  return requestOperation("swap-tokens", {
    movingTokenUuid: moving.uuid,
    targetTokenUuid: target.document.uuid,
  }, { authorityUserId: game.user.id });
}

async function performSeekResponse(context) {
  await useAction("seek", context.actor);
  const followUp = await choose({
    title: context.item?.name ?? "Seek and Destroy",
    label: "Reaction after Seek",
    choices: [
      { value: "point-out", label: "Point Out" },
      { value: "stride", label: "Stride toward an observed enemy" },
      { value: "strike", label: "Strike an observed enemy" },
      { value: "finish", label: "Finish after Seek" },
    ],
  });
  if (followUp == null) return "used Seek; follow-up skipped";
  if (followUp === "point-out") {
    await useAction("point-out", context.actor);
    return "used Seek, then Pointed Out";
  }
  if (followUp === "stride") {
    const movement = await performTacticMovement({ ...context, step: { kind: "movement", allowance: "full", modes: "land", relation: "toward-target", target: "enemy" } });
    return movement ? `used Seek, then ${movement}` : "used Seek; movement skipped";
  }
  if (followUp === "strike") {
    const rolled = await rollStrike(context.actor, { title: context.item?.name });
    return rolled ? `used Seek, then ${rolled}` : "used Seek; Strike skipped";
  }
  return "used Seek";
}

async function performSlipAndSizzle(actor, item, targetUuid, role) {
  const target = await requireTacticTarget(actor, "enemy", targetUuid);
  if (!["trip", "spell"].includes(role)) throw new Error("Slip and Sizzle roles were not assigned.");
  if (role === "trip") {
    await useAction("trip", actor);
    return `attempted to Trip ${target.name}; the spellcaster responds only on success`;
  }
  notify("info", `Cast a damaging ranged spell of 2 actions or fewer at ${target.name}. If it uses a slot or Focus Point, apply slowed 1 until the end of your next turn.`);
  actor.sheet?.render?.(true);
  return `opened spellcasting for the follow-up against ${target.name}; apply slowed 1 if a slot or Focus Point is spent`;
}

async function performSequence(context, response) {
  const results = [];
  for (const step of response.steps ?? []) {
    let result = null;
    if (step.kind === "movement") result = await performTacticMovement({ ...context, step });
    else if (step.kind === "strike") result = await rollStrike(context.actor, { mode: step.mode, title: context.item?.name });
    else if (step.kind === "action-choice") result = await executeChoice(context.actor, step, context.item?.name ?? "Commander Tactic");
    else if (step.kind === "action") {
      await useAction(step.slug, context.actor);
      result = `used ${step.label ?? step.slug}`;
    } else if (step.kind === "reload") result = await reload(context.actor, { optional: step.optional });
    else if (step.kind === "heal") result = await healActor(context.actor, step.amount);
    else if (step.kind === "effect") result = `gained ${await grantCompendiumEffect(context.actor, step.uuid)}`;
    else if (step.kind === "manual") {
      notify("info", step.instruction);
      result = step.instruction;
    }
    if (step.kind === "target") {
      const target = await requireTacticTarget(context.actor, step.target, context.targetUuid);
      result = `targeted ${target.name}`;
    }
    if (result == null) return results.length ? `${results.join("; ")}; remaining response skipped` : null;
    results.push(result);
  }
  return results.join("; ");
}

async function focusActor(actor) {
  const token = activeTokenFor(actor);
  if (!token) return;
  token.control({ releaseOthers: true });
  await canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
}

export async function performResponse({ actor, commander, item, response, role, tokenUuid, commanderTokenUuid }) {
  await focusActor(actor);
  switch (response.kind) {
    case "effect":
      return `gained ${await grantCompendiumEffect(actor, response.uuid)}`;
    case "raise-shield": {
      const raise = game.pf2e.actions.raiseAShield;
      if (typeof raise !== "function") throw new Error("PF2e Raise a Shield automation is unavailable.");
      await raise({ actors: actor });
      return "raised a shield";
    }
    case "reload":
      return reload(actor);
    case "strike":
      return rollStrike(actor, { mode: response.mode, title: item?.name });
    case "seek":
      return performSeekResponse({ actor, commander, item, tokenUuid, commanderTokenUuid });
    case "swap":
      return performSwap(actor, tokenUuid);
    case "slip-and-sizzle":
      return performSlipAndSizzle(actor, item, response.targetUuid, role);
    case "maneuver":
      await useAction(response.action, actor);
      return `used ${response.action}`;
    case "maneuver-choice":
      return maneuverChoice(actor);
    case "effect-and-maneuver":
      await grantCompendiumEffect(actor, response.uuid);
      return maneuverChoice(actor);
    case "effect-and-manual":
      await grantCompendiumEffect(actor, response.uuid);
      return "gained the PF2e penalty-choice effect; finish the formation manually";
    case "wait-for-it":
      await grantWaitForIt(actor, commander, item);
      return "gained the guarded stance effect; remove it early if the tactic says it ends";
    case "piranha-assault":
      return grantPiranhaAssault(actor, commander, item, response.targetUuid);
    case "shadows-in-the-moonlight":
      await grantShadowsInMoonlight(actor, commander, item);
      if (role === "hide-sneak") {
        const action = await choose({
          title: item?.name ?? "Shadows in the Moonlight",
          label: "Free action",
          choices: [{ value: "hide", label: "Hide" }, { value: "sneak", label: "Sneak" }],
        });
        if (action) {
          await useAction(action, actor);
          return `tracked formation benefits and used ${action}`;
        }
      }
      return "tracked formation benefits until the commander's next turn";
    case "gather-to-me":
      return performGatherMovement({ actor, commander, tokenUuid, commanderTokenUuid });
    case "sequence":
      return performSequence({ actor, commander, item, tokenUuid, commanderTokenUuid, targetUuid: response.targetUuid }, response);
    default:
      return response.instruction;
  }
}
