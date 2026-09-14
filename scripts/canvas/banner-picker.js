import { bannerCorner, hasClaimTheField, claimTheFieldRange } from "../domain/banner-placement.js";
import { activeTokenFor } from "../foundry/runtime.js";

let cancelActive = null;

export function closestBannerCorner(bounds, point) {
  return ["nw", "ne", "sw", "se"].sort((left, right) => {
    const a = bannerCorner(bounds, left), b = bannerCorner(bounds, right);
    return Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y);
  })[0];
}

export function pickBannerCorner(actor, { range = hasClaimTheField(actor) ? claimTheFieldRange(actor) : 0 } = {}) {
  cancelActive?.();
  const token = activeTokenFor(actor);
  if (!canvas?.ready || !token) throw new Error("Place the commander on the active scene first.");
  const bounds = token.document?.mechanicalBounds ?? token.bounds;
  const stage = canvas.stage;
  const view = canvas.app.canvas ?? canvas.app.view;
  return new Promise((resolve) => {
    const graphics = new PIXI.Graphics();
    graphics.eventMode = "none";
    stage.addChild(graphics);
    const previousCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    const selectedPoint = (point) => range
      ? canvas.grid.getSnappedPoint(point, { mode: CONST.GRID_SNAPPING_MODES.VERTEX })
      : closestBannerCorner(bounds, point);
    const inRange = (point) => canvas.grid.measurePath([
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, point,
    ]).distance <= range;
    const draw = (selected) => {
      graphics.clear();
      if (range) {
        if (selected) graphics.lineStyle(3, inRange(selected) ? 0xffd166 : 0xff4444, 1)
          .beginFill(0x171b24, 0.9).drawCircle(selected.x, selected.y, 13).endFill();
        return;
      }
      for (const corner of ["nw", "ne", "sw", "se"]) {
        const point = bannerCorner(bounds, corner);
        graphics.lineStyle(3, 0xffd166, 1).beginFill(0x171b24, 0.9)
          .drawCircle(point.x, point.y, corner === selected ? 13 : 8).endFill();
      }
    };
    const location = (event) => {
      const rect = view.getBoundingClientRect();
      return stage.toLocal({ x: (event.clientX - rect.left) * canvas.app.screen.width / rect.width,
        y: (event.clientY - rect.top) * canvas.app.screen.height / rect.height });
    };
    const cleanup = (result = null) => {
      view.removeEventListener("pointermove", move, true);
      view.removeEventListener("pointerdown", click, true);
      view.removeEventListener("contextmenu", cancel, true);
      document.removeEventListener("keydown", key, true);
      Hooks.off("canvasTearDown", teardown);
      view.style.cursor = previousCursor;
      graphics.destroy();
      cancelActive = null;
      resolve(result);
    };
    const cancel = (event) => { event?.preventDefault(); event?.stopImmediatePropagation(); cleanup(); };
    const key = (event) => { if (event.key === "Escape") cancel(event); };
    const move = (event) => draw(selectedPoint(location(event)));
    const click = (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.button !== 0) return cleanup();
      const selected = selectedPoint(location(event));
      if (range && !inRange(selected)) {
        ui.notifications.warn(`Choose a corner within ${range} feet.`);
        return;
      }
      cleanup(selected);
    };
    const teardown = Hooks.on("canvasTearDown", () => cleanup());
    cancelActive = () => cleanup();
    view.addEventListener("pointermove", move, true);
    view.addEventListener("pointerdown", click, true);
    view.addEventListener("contextmenu", cancel, true);
    document.addEventListener("keydown", key, true);
    draw(null);
    ui.notifications.info(range ? `Claim the Field: choose a corner within ${range} feet. Escape or right-click cancels.`
      : "Click near a banner corner. Escape or right-click cancels.");
  });
}
