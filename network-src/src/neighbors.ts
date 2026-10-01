// Neighbour lists for the information pane.

import type { IVGraph } from "./data";

export interface NeighborLists {
  mutual: string[];
  incoming: string[];
  outgoing: string[];
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortByLabel(graph: IVGraph, keys: Iterable<string>): string[] {
  return [...keys].sort((a, b) => collator.compare(graph.getNodeAttribute(a, "label"), graph.getNodeAttribute(b, "label")));
}

/**
 * Splits neighbours by edge direction, as `informationPanel.groupByEdgeDirection`
 * asks: a node linked both ways is mutual and appears only there.
 */
export function neighborsByDirection(graph: IVGraph, node: string): NeighborLists {
  const incoming = new Set(graph.inNeighbors(node));
  const outgoing = new Set(graph.outNeighbors(node));
  incoming.delete(node);
  outgoing.delete(node);
  const mutual = [...incoming].filter((key) => outgoing.has(key));
  for (const key of mutual) {
    incoming.delete(key);
    outgoing.delete(key);
  }
  return { mutual: sortByLabel(graph, mutual), incoming: sortByLabel(graph, incoming), outgoing: sortByLabel(graph, outgoing) };
}

export function allNeighbors(graph: IVGraph, node: string): string[] {
  return sortByLabel(graph, graph.neighbors(node).filter((key) => key !== node));
}
