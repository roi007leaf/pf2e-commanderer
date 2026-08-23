import { MODULE_ID } from "./constants.js";
import { CommanderEngine, activateChatCards } from "./engine.js";
import { hasCommanderFeatures } from "./foundry/runtime.js";
import { registerSocket } from "./foundry/socket.js";
import { registerPlantedBannerEffects } from "./foundry/banner-effects.js";
import { openCommanderPanel } from "./ui/panel.js";
import { registerCommanderTokenHud } from "./ui/token-hud.js";
import { registerBannerOverlay } from "./canvas/banner-overlay.js";

let engine;

registerCommanderTokenHud(() => engine);
registerBannerOverlay();

Hooks.once("ready", () => {
  registerSocket();
  registerPlantedBannerEffects();
  engine = new CommanderEngine();
  activateChatCards(engine);

  const module = game.modules.get(MODULE_ID);
  module.api = Object.freeze({
    execute: (item, actor = item?.actor) => engine.execute(item, actor),
    open: (actor) => openCommanderPanel(actor, engine),
  });
  console.info(`${MODULE_ID} | Ready`);
});

Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => {
  const actor = sheet.document;
  if (!actor?.isOwner || !hasCommanderFeatures(actor)) return;
  controls.unshift({
    action: "pf2e-commanderer",
    icon: "fa-solid fa-flag",
    label: "Commander",
    onClick: () => openCommanderPanel(actor, engine),
  });
});
