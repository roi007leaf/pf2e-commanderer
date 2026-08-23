import { MODULE_ID } from "../constants.js";
import {
  bannerActive,
  bannerToggle,
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
    content.innerHTML = result;
    return content;
  }

  static async setSquad() {
    if (await setTargetedSquad(this.actor)) this.render({ force: true });
  }

  static async addNearbySquad() {
    if (await addNearbySquadCandidates(this.actor)) this.render({ force: true });
  }

  static async toggleSquadMember(_event, button) {
    if (await toggleSquadMember(this.actor, button.dataset.actorUuid)) this.render({ force: true });
  }

  static toggleSquadPlanner() {
    this.squadPlannerExpanded = !this.squadPlannerExpanded;
    this.render({ force: true });
  }

  static async clearSquad() {
    await clearSquad(this.actor);
    this.render({ force: true });
  }

  static async toggleBanner() {
    try {
      await setBannerActive(this.actor, !bannerActive(this.actor));
      this.render({ force: true });
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
    this.render({ force: true });
  }

  static async plantBannerAtCorner(_event, button) {
    try {
      await plantBanner(this.actor, button.dataset.corner);
      this.bannerPlacementExpanded = false;
      this.render({ force: true });
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
        this.render({ force: true });
        notify("info", "Banner retrieved. Its abilities originate from the commander again.");
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Retrieve banner`, error);
      notify("error", error.message);
    }
  }

  static async prepare(_event, button) {
    if (await togglePreparedTactic(this.actor, button.dataset.itemId)) this.render({ force: true });
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
    if (this.expandedTactics.has(itemId)) this.expandedTactics.delete(itemId);
    else this.expandedTactics.add(itemId);
    this.render({ force: true });
  }

  static openDailies() {
    const api = getDailiesApi();
    if (typeof api?.openDailiesInterface === "function") api.openDailiesInterface(this.actor);
  }
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
