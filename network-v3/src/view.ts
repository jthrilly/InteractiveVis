// What the viewer currently highlights, and the sigma reducers that draw it.
// Reducers derive display attributes from this state on every render, so the
// graph itself is never mutated (sigma 0.1 rewrote node colours in place).

import type { Settings } from "sigma/settings";
import type { HoverBehavior } from "./config";
import type { IVGraph } from "./data";

/** Colour sigma 0.1 used for dimmed nodes and edges. */
export const DIM_COLOR = "#ccc";

export interface ViewState {
  /** Node under the pointer, if hover behaviour needs it. */
  hovered: string | null;
  /** The hovered node and its neighbours. */
  hoveredNeighborhood: Set<string>;
}

export function createViewState(): ViewState {
  return { hovered: null, hoveredNeighborhood: new Set() };
}

export function setHovered(state: ViewState, graph: IVGraph, node: string | null): void {
  state.hovered = node;
  state.hoveredNeighborhood = node === null ? new Set() : new Set([node, ...graph.neighbors(node)]);
}

type Reducers = Pick<Settings, "nodeReducer" | "edgeReducer">;

export function makeReducers(graph: IVGraph, state: ViewState, hoverBehavior: HoverBehavior): Reducers {
  return {
    nodeReducer: (node, data) => {
      if (state.hovered === null || hoverBehavior === "default" || state.hoveredNeighborhood.has(node)) return data;
      return hoverBehavior === "hide" ? { ...data, hidden: true } : { ...data, color: DIM_COLOR, zIndex: -1 };
    },
    edgeReducer: (edge, data) => {
      if (state.hovered === null || hoverBehavior === "default" || graph.hasExtremity(edge, state.hovered)) return data;
      return hoverBehavior === "hide" ? { ...data, hidden: true } : { ...data, color: DIM_COLOR, zIndex: -1 };
    },
  };
}
