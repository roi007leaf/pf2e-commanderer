import { MODULE_ID } from "../constants.js";
import {
  bannerActive,
  bannerToggle,
  dailiesPreparationActor,
  getDailiesApi,
  notify,
  ownedTactics,
  preparationLimit,
  preparedTacticIds,
  setBannerActive,
  togglePreparedTactic,
} from "../foundry/runtime.js";
import {
  addNearbySquadCandidates,
  clearSquad,
  sceneSquadCandidates,
  setTargetedSquad,
  squadLimit,
  squadTacticalState,
  storedSquad,
  toggleSquadMember,
} from "../foundry/squad.js";
import { tacticAudience } from "../domain/squad-readiness.js";
import { tacticDefinition } from "../domain/tactics.js";
import { hasPlantBanner } from "../domain/banner-placement.js";
import { canRetrieveBanner, plantBanner, plantedBanner, retrieveBanner } from "../foundry/banner.js";
import { tacticViewModel } from "./tactic-view-model.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/panel.hbs`;
const LIVE_REFRESH_DELAY = 50;
let liveUpdatesRegistered = false;

export class CommanderPanel extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "pf2e-commanderer-panel-{id}",
    classes: ["pf2e-commanderer", "standard-form"],
    tag: "section",
    window: { title: "Commander", icon: "fa-solid fa-flag", resizable: true },
    position: { width: 680, height: 720 },
    actions: {
      setSquad: CommanderPanel.setSquad,
      addNearbySquad: CommanderPanel.addNearbySquad,
      toggleSquadMember: CommanderPanel.toggleSquadMember,
      toggleSquadPlanner: CommanderPanel.toggleSquadPlanner,
      clearSquad: CommanderPanel.clearSquad,
      toggleBanner: CommanderPanel.toggleBanner,
      toggleBannerPlacement: CommanderPanel.toggleBannerPlacement,
      plantBannerAtCorner: CommanderPanel.plantBannerAtCorner,
      retrieveBanner: CommanderPanel.retrieveBanner,
      prepare: CommanderPanel.prepare,
      issue: CommanderPanel.issue,
      openDailies: CommanderPanel.openDailies,
      toggleTacticDetails: CommanderPanel.toggleTacticDetails,
    },
  };

  constructor(actor, engine, options = {}) {
    super({ ...options, id: `pf2e-commanderer-panel-${actor.id}` });
    this.actor = actor;
    this.engine = engine;
    this.expandedTactics = new Set();
    this.squadPlannerExpanded = false;
    this.bannerPlacementExpanded = false;
    this._refreshTimer = null;
  }

  get title() {
    return `${this.actor.name} — Commander`;
  }

  async _prepareContext() {
    const placement = plantedBanner(this.actor);
    const prepared = preparedTacticIds(this.actor);
    const dailiesManaged = Boolean(getDailiesApi());
    const tacticalSquad = await squadTacticalState(this.actor);
    const tactics = await Promise.all(ownedTactics(this.actor).map(async (item) => tacticViewModel(item, {
      prepared: prepared.has(item.id),
      expanded: this.expandedTactics.has(item.id),
      description: await enrichDescription(item, this.actor),
      audience: tacticAudience(tacticDefinition(item.slug), tacticalSquad, { bannerActive: bannerActive(this.actor) }),
      traitDescriptions: globalThis.CONFIG?.PF2E?.traitsDescriptions ?? {},
    })));
    tactics.sort((left, right) => Number(right.prepared) - Number(left.prepared) || left.name.localeCompare(right.name));
    const stored = storedSquad(this.actor);
    const tacticalByActor = new Map(tacticalSquad.map((member) => [member.actorUuid, member]));
    const squad = stored.map((entry) => tacticalByActor.get(entry.actorUuid) ?? {
      ...entry,
      auraActive: bannerActive(this.actor),
      onScene: false,
      inBannerAura: false,
    });
    const limit = squadLimit(this.actor);
    const squadFull = stored.length >= limit;
    const squadCandidates = sceneSquadCandidates(this.actor).map((candidate) => ({
      ...candidate,
      canToggle: candidate.current || !squadFull,
    }));
    return {
      actorName: this.actor.name,
      actorImg: this.actor.img,
      actorLevel: this.actor.level ?? this.actor.system?.details?.level?.value ?? 0,
      bannerActive: bannerActive(this.actor),
      bannerToggleAvailable: Boolean(bannerToggle(this.actor)),
      bannerPlanted: Boolean(placement),
      bannerRadius: placement?.radius ?? 30,
      bannerRetrievable: canRetrieveBanner(this.actor),
      plantBannerAvailable: hasPlantBanner(this.actor),
      bannerPlacementExpanded: this.bannerPlacementExpanded,
      squad,
      squadCount: stored.length,
      squadLimit: limit,
      squadFull,
      squadPlannerExpanded: this.squadPlannerExpanded,
      squadCandidates,
      nearbyCandidateCount: squadCandidates.filter((candidate) => candidate.inBannerAura && !candidate.current).length,
      tactics,
      preparedCount: prepared.size,
      preparationLimit: preparationLimit(this.actor),
      dailiesManaged,
      tacticCount: tactics.length,
    };
  }

  async _renderHTML(context) {
    return foundry.applications.handlebars.renderTemplate(TEMPLATE, context);
  }

  _replaceHTML(result, content) {
    const scrollTop = content.querySelector(".commanderer-panel")?.scrollTop ?? 0;
    content.innerHTML = result;
    const panel = content.querySelector(".commanderer-panel");
    if (panel) panel.scrollTop = scrollTop;
    return content;
  }

  requestRefresh() {
    if (this._refreshTimer) globalThis.clearTimeout(this._refreshTimer);
    this._refreshTimer = globalThis.setTimeout(() => {
      this._refreshTimer = null;
      if (foundry.applications.instances.get(this.id) === this) this.render({ force: true });
    }, LIVE_REFRESH_DELAY);
  }

  _onClose(options) {
    if (this._refreshTimer) globalThis.clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
    super._onClose(options);
  }

  static async setSquad() {
    if (await setTargetedSquad(this.actor)) this.requestRefresh();
  }

  static async addNearbySquad() {
    if (await addNearbySquadCandidates(this.actor)) this.requestRefresh();
  }

  static async toggleSquadMember(_event, button) {
    if (await toggleSquadMember(this.actor, button.dataset.actorUuid)) this.requestRefresh();
  }

  static toggleSquadPlanner() {
    this.squadPlannerExpanded = !this.squadPlannerExpanded;
    this.requestRefresh();
  }

  static async clearSquad() {
    await clearSquad(this.actor);
    this.requestRefresh();
  }

  static async toggleBanner() {
    try {
      await setBannerActive(this.actor, !bannerActive(this.actor));
      this.requestRefresh();
    } catch (error) {
      console.error(`${MODULE_ID} | Toggle banner`, error);
      notify("error", error.message);
    }
  }

  static toggleBannerPlacement() {
    if (!hasPlantBanner(this.actor)) {
      notify("warn", "Plant Banner requires the Plant Banner feat.");
      return;
    }
    this.bannerPlacementExpanded = !this.bannerPlacementExpanded;
    this.requestRefresh();
  }

  static async plantBannerAtCorner(_event, button) {
    try {
      await plantBanner(this.actor, button.dataset.corner);
      this.bannerPlacementExpanded = false;
      this.requestRefresh();
      notify("info", "Banner planted. Its abilities now originate from the 40-foot burst.");
    } catch (error) {
      console.error(`${MODULE_ID} | Plant banner`, error);
      notify("error", error.message);
    }
  }

  static async retrieveBanner() {
    try {
      if (await retrieveBanner(this.actor)) {
        this.bannerPlacementExpanded = false;
        this.requestRefresh();
        notify("info", "Banner retrieved. Its abilities originate from the commander again.");
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Retrieve banner`, error);
      notify("error", error.message);
    }
  }

  static async prepare(_event, button) {
    if (await togglePreparedTactic(this.actor, button.dataset.itemId)) this.requestRefresh();
  }

  static async issue(_event, button) {
    const item = this.actor.items.get(button.dataset.itemId);
    try {
      await this.engine.execute(item, this.actor);
    } catch (error) {
      console.error(`${MODULE_ID} | Issue tactic`, error);
      notify("error", error.message);
    }
  }

  static toggleTacticDetails(_event, button) {
    const itemId = button.dataset.itemId;
    const expanded = !this.expandedTactics.has(itemId);
    if (expanded) this.expandedTactics.add(itemId);
    else this.expandedTactics.delete(itemId);
    const tactic = button.closest(".commanderer-tactic");
    tactic?.classList.toggle("expanded", expanded);
    const details = tactic?.querySelector(".commanderer-tactic-details");
    if (details) details.hidden = !expanded;
    button.setAttribute("aria-expanded", String(expanded));
    const tacticName = button.querySelector?.("strong")?.textContent?.trim() ?? "tactic";
    button.title = `${expanded ? "Hide" : "Show"} details for ${tacticName}`;
  }

  static openDailies() {
    const api = getDailiesApi();
    if (typeof api?.openDailiesInterface === "function") {
      api.openDailiesInterface(dailiesPreparationActor(this.actor));
    }
  }
}

function openCommanderPanels() {
  return [...(foundry.applications.instances?.values?.() ?? [])]
    .filter((application) => application instanceof CommanderPanel);
}

function actorAffectsPanel(panel, actor) {
  if (!actor?.uuid) return false;
  const panelActorUuid = dailiesPreparationActor(panel.actor)?.uuid;
  const updatedActorUuid = dailiesPreparationActor(actor)?.uuid;
  if (panelActorUuid && panelActorUuid === updatedActorUuid) return true;
  return storedSquad(panel.actor).some((member) => member.actorUuid === actor.uuid);
}

function refreshPanelsForActor(actor, { candidates = false } = {}) {
  for (const panel of openCommanderPanels()) {
    if (actorAffectsPanel(panel, actor) || (candidates && panel.squadPlannerExpanded)) panel.requestRefresh();
  }
}

function refreshAllPanels() {
  for (const panel of openCommanderPanels()) panel.requestRefresh();
}

function scenePlacementChanged(scene, changes) {
  if (scene?.id !== globalThis.canvas?.scene?.id) return false;
  const flattened = foundry.utils?.flattenObject?.(changes ?? {}) ?? changes ?? {};
  return Object.keys(flattened).some((key) => key.includes(`flags.${MODULE_ID}`) && key.includes("plantedBanners"));
}

export function registerCommanderPanelLiveUpdates() {
  if (liveUpdatesRegistered) return;
  liveUpdatesRegistered = true;
  Hooks.on("updateToken", (token) => refreshPanelsForActor(token?.actor, { candidates: true }));
  Hooks.on("createToken", (token) => refreshPanelsForActor(token?.actor, { candidates: true }));
  Hooks.on("deleteToken", (token) => refreshPanelsForActor(token?.actor, { candidates: true }));
  Hooks.on("updateActor", (actor) => refreshPanelsForActor(actor, { candidates: true }));
  Hooks.on("createItem", (item) => refreshPanelsForActor(item?.actor ?? item?.parent));
  Hooks.on("updateItem", (item) => refreshPanelsForActor(item?.actor ?? item?.parent));
  Hooks.on("deleteItem", (item) => refreshPanelsForActor(item?.actor ?? item?.parent));
  Hooks.on("targetToken", () => {
    for (const panel of openCommanderPanels()) {
      if (panel.squadPlannerExpanded) panel.requestRefresh();
    }
  });
  Hooks.on("updateScene", (scene, changes) => {
    if (scenePlacementChanged(scene, changes)) refreshAllPanels();
  });
  Hooks.on(`${MODULE_ID}.bannerPlacementChanged`, refreshAllPanels);
}

async function enrichDescription(item, actor) {
  const source = item.system?.description?.value ?? "";
  const TextEditorClass = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  if (typeof TextEditorClass?.enrichHTML !== "function") return source;
  try {
    return await TextEditorClass.enrichHTML(source, {
      async: true,
      relativeTo: item,
      secrets: actor.isOwner,
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not enrich tactic description`, error);
    return source;
  }
}

export function openCommanderPanel(actor, engine) {
  if (!actor?.isOwner) {
    notify("warn", "You do not own this commander.");
    return null;
  }
  const id = `pf2e-commanderer-panel-${actor.id}`;
  const existing = foundry.applications.instances.get(id);
  if (existing) return existing.bringToFront();
  return new CommanderPanel(actor, engine).render({ force: true });
}
