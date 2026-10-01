// Node search. The sigma 0.1 viewer built a RegExp from the raw input, so
// characters like "(" or "+" broke it; this is a plain case-insensitive
// substring match instead.

import type { IVGraph } from "./data";

/** sigma 0.1 asked for at least this many characters. */
export const MIN_QUERY_LENGTH = 3;

export interface SearchHit {
  key: string;
  label: string;
}

/**
 * Nodes whose label contains `query`, then (with `fulltext`) nodes with an
 * attribute value containing it. `exact` matches the whole label, which is
 * how `#label` links find their node.
 */
export function searchNodes(graph: IVGraph, query: string, options: { fulltext: boolean; exact?: boolean }): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  graph.forEachNode((key, attrs) => {
    const label = attrs.label.toLowerCase();
    if (options.exact ? label === needle : label.includes(needle)) {
      hits.push({ key, label: attrs.label });
      return;
    }
    if (options.fulltext && !options.exact) {
      for (const value of Object.values(attrs.attributes)) {
        if (value !== null && String(value).toLowerCase().includes(needle)) {
          hits.push({ key, label: attrs.label });
          return;
        }
      }
    }
  });
  return hits;
}
