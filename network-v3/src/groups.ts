// Entries for the group selector, built from data.computeGroups.

import { computeGroups, type IVGraph } from "./data";

export interface Group {
  /** Name shown in the selector and used in #links. */
  name: string;
  /** Swatch colour: the members' most common node colour. */
  color: string;
  members: string[];
}

function mostCommonColor(graph: IVGraph, members: string[]): string {
  const counts = new Map<string, number>();
  for (const key of members) {
    const color = graph.getNodeAttribute(key, "color");
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [color, count] of counts) {
    if (count > bestCount) [best, bestCount] = [color, count];
  }
  return best;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Colour groups keep data order and are called "Group 1", "Group 2"... as in
 * the sigma 0.1 viewer. Attribute groups are named by their value and sorted
 * naturally, so "Class 2" comes before "Class 10".
 */
export function listGroups(graph: IVGraph, groupBy: string): Group[] {
  const { by, groups } = computeGroups(graph, groupBy);
  if (by === "color") {
    return [...groups].map(([color, members], i) => ({ name: `Group ${i + 1}`, color, members }));
  }
  return [...groups]
    .map(([name, members]) => ({ name, color: mostCommonColor(graph, members), members }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function findGroup(groups: Group[], name: string): Group | undefined {
  const wanted = name.trim().toLowerCase();
  return groups.find((group) => group.name.toLowerCase() === wanted);
}
