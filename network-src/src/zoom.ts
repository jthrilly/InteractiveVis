// The zoom in / zoom out / reset buttons from the sigma 0.1 viewer, which
// zoomed in by 1.5x and out by 2x.

import type Sigma from "sigma";

const DURATION = 250;

export function bindZoomButtons(renderer: Sigma, root: ParentNode = document): void {
  const camera = renderer.getCamera();
  const actions: Record<string, () => void> = {
    in: () => void camera.animatedZoom({ duration: DURATION, factor: 1.5 }),
    out: () => void camera.animatedUnzoom({ duration: DURATION, factor: 2 }),
    reset: () => void camera.animatedReset({ duration: DURATION }),
  };
  root.querySelectorAll<HTMLButtonElement>("#zoom button[data-zoom]").forEach((button) => {
    const action = actions[button.dataset.zoom ?? ""];
    if (action) button.addEventListener("click", action);
  });
}
