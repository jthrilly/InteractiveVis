// Rendering attributes computed once after loading. Kept free of sigma's
// WebGL modules so it can be unit-tested outside a browser.

import { parseColor } from "sigma/utils";
import type { ViewerConfig } from "./config";
import type { IVGraph } from "./data";
import { edgeProgram, parallelCurvature, parallelSlots } from "./edges";

/** Page background behind the graph, as in the sigma 0.1 viewer's CSS. */
export const BACKGROUND = "#eeeeee";

/**
 * sigma 0.1 stroked edges 0.2-0.5px wide on canvas, so they showed as faint
 * lines that stayed faint when zoomed in. WebGL edges can't be that thin,
 * and translucent WebGL colours wash out on a light page, so edges are
 * instead drawn in their colour mixed this far towards the background.
 */
export const EDGE_FADE = 0.35;

export function fadeTowards(color: string, background: string, amount: number): string {
  const c = parseColor(color);
  const bg = parseColor(background);
  // A translucent colour is composited over the background first, so its own
  // transparency still shows (a fully transparent edge stays invisible).
  const weight = (1 - amount) * c.a;
  const mix = (a: number, b: number) => Math.round(b + (a - b) * weight);
  return `rgb(${mix(c.r, bg.r)},${mix(c.g, bg.g)},${mix(c.b, bg.b)})`;
}

/**
 * Sets each edge's colour, sigma program and curvature. `type` and
 * `curvature` are rendering attributes owned by the viewer; Gephi columns
 * stay under `attributes`.
 */
export function prepareEdges(graph: IVGraph, config: Pick<ViewerConfig, "edgeStyle">): void {
  const slots = parallelSlots(graph.mapEdges((key, _attrs, source, target) => ({ key, source, target })));
  graph.updateEachEdgeAttributes((key, attrs) => {
    const slot = slots.get(key);
    return {
      ...attrs,
      color: fadeTowards(attrs.color, BACKGROUND, EDGE_FADE),
      type: edgeProgram(config.edgeStyle, attrs.directed, (slot?.count ?? 1) > 1),
      curvature: parallelCurvature(slot),
    };
  });
}
