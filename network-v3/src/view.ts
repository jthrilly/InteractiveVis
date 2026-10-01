// What the viewer currently shows, and the sigma reducers that draw it.
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
  /** Node whose information pane is open. */
  selected: string | null;
  /** Group whose member list is open. */
  group: string | null;
  /** Nodes left visible by the selected node or group; null shows everything. */
  focus: Set<string> | null;
  /** Node highlighted from a list in the panes. */
  highlighted: string | null;
}

export function createViewState(): ViewState {
  return { hovered: null, hoveredNeighborhood: new Set(), selected: null, group: null, focus: null, highlighted: null };
}

export function setHovered(state: ViewState, graph: IVGraph, node: string | null): void {
  state.hovered = node;
  state.hoveredNeighborhood = node === null ? new Set() : new Set([node, ...graph.neighbors(node)]);
}

/** Shows only the node and its neighbours, as the sigma 0.1 viewer did on click. */
export function selectNode(state: ViewState, graph: IVGraph, node: string): void {
  state.selected = node;
  state.group = null;
  state.focus = new Set([node, ...graph.neighbors(node)]);
  state.highlighted = null;
}

/** Shows only the members of a group. */
export function selectGroup(state: ViewState, name: string, members: Iterable<string>): void {
  state.selected = null;
  state.group = name;
  state.focus = new Set(members);
  state.highlighted = null;
}

export function clearSelection(state: ViewState): void {
  state.selected = null;
  state.group = null;
  state.focus = null;
  state.highlighted = null;
}

type Reducers = Pick<Settings, "nodeReducer" | "edgeReducer">;

export function makeReducers(graph: IVGraph, state: ViewState, hoverBehavior: HoverBehavior): Reducers {
  const hoverApplies = () => state.hovered !== null && hoverBehavior !== "default";
  return {
    nodeReducer: (node, data) => {
      if (state.focus && !state.focus.has(node)) return { ...data, hidden: true };
      let result = data;
      if (node === state.selected || node === state.highlighted) {
        result = { ...result, highlighted: true, forceLabel: true, zIndex: 2 };
      }
      if (hoverApplies() && !state.hoveredNeighborhood.has(node)) {
        result = hoverBehavior === "hide" ? { ...result, hidden: true } : { ...result, color: DIM_COLOR, zIndex: -1 };
      }
      return result;
    },
    edgeReducer: (edge, data) => {
      if (state.focus && !(state.focus.has(graph.source(edge)) && state.focus.has(graph.target(edge)))) {
        return { ...data, hidden: true };
      }
      if (hoverApplies()) {
        // sigma 0.1's hide only hid nodes, so edges between two neighbours stayed;
        // its dim greyed every edge not touching the hovered node.
        if (hoverBehavior === "hide") {
          const near = state.hoveredNeighborhood;
          if (!near.has(graph.source(edge)) || !near.has(graph.target(edge))) return { ...data, hidden: true };
        } else if (!graph.hasExtremity(edge, state.hovered)) {
          return { ...data, color: DIM_COLOR, zIndex: -1 };
        }
      }
      return data;
    },
  };
}
