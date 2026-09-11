import { bannerCorner } from "../domain/banner-placement.js";
import { activeTokenFor } from "../foundry/runtime.js";

let cancelActive = null;

export function closestBannerCorner(bounds, point) {
  return ["nw", "ne", "sw", "se"].sort((left, right) => {
    const a = bannerCorner(bounds, left), b = bannerCorner(bounds, right);
    return Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y);
  })[0];
}

export function pickBannerCorner(actor) {
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
    const draw = (selected) => {
      graphics.clear();
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
    const move = (event) => draw(closestBannerCorner(bounds, location(event)));
    const click = (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      cleanup(event.button === 0 ? closestBannerCorner(bounds, location(event)) : null);
    };
    const teardown = Hooks.on("canvasTearDown", () => cleanup());
    cancelActive = () => cleanup();
    view.addEventListener("pointermove", move, true);
    view.addEventListener("pointerdown", click, true);
    view.addEventListener("contextmenu", cancel, true);
    document.addEventListener("keydown", key, true);
    draw(null);
    ui.notifications.info("Click near a banner corner. Escape or right-click cancels.");
  });
}
