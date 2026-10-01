// Which sigma edge program draws each edge, and how far parallel edges bend.
// Kept free of sigma imports so it can be unit-tested outside a browser.

import type { EdgeStyle } from "./config";

/** sigma program name for each edge style, and its undirected counterpart. */
const PROGRAM_FOR_STYLE: Record<EdgeStyle, { directed: string; undirected: string }> = {
  line: { directed: "line", undirected: "line" },
  arrow: { directed: "arrow", undirected: "line" },
  curve: { directed: "curve", undirected: "curve" },
  curvedArrow: { directed: "curvedArrow", undirected: "curve" },
};

/** Curved counterpart of each program, used to pull parallel edges apart. */
const CURVED: Record<string, string> = { line: "curve", arrow: "curvedArrow", curve: "curve", curvedArrow: "curvedArrow" };

/** Same value as @sigma/edge-curve's DEFAULT_EDGE_CURVATURE, which matches sigma 0.1's curve. */
export const DEFAULT_CURVATURE = 0.25;

/**
 * Edge program for one edge. Arrow styles draw arrows only on edges the
 * export marks as directed; edges with no `directed` flag (every export
 * before this field existed) follow the configured style as before.
 * Parallel edges (several edges between the same two nodes) are always
 * curved, so they don't draw on top of each other.
 */
export function edgeProgram(style: EdgeStyle, directed: boolean | undefined, parallel = false): string {
  const programs = PROGRAM_FOR_STYLE[style];
  const program = directed === false ? programs.undirected : programs.directed;
  return parallel ? CURVED[program] : program;
}

/** Where an edge sits among edges with the same source and target. */
export interface ParallelSlot {
  /** Position in its bundle, centred on 0: -1, 0, 1 for three edges. */
  index: number;
  /** Number of edges in the bundle. */
  count: number;
}

/**
 * Groups edges that share source, target and direction. An a->b plus b->a
 * pair is not a bundle: curved styles already bend the two to opposite
 * sides, and straight styles drew them on top of each other in sigma 0.1 too.
 */
export function parallelSlots(edges: Iterable<{ key: string; source: string; target: string }>): Map<string, ParallelSlot> {
  const bundles = new Map<string, string[]>();
  for (const { key, source, target } of edges) {
    const id = JSON.stringify([source, target]);
    const bundle = bundles.get(id);
    if (bundle) bundle.push(key);
    else bundles.set(id, [key]);
  }
  const slots = new Map<string, ParallelSlot>();
  for (const bundle of bundles.values()) {
    bundle.forEach((key, i) => slots.set(key, { index: i - (bundle.length - 1) / 2, count: bundle.length }));
  }
  return slots;
}

/** Curvature that keeps the edges of a bundle apart, spreading wider bundles less per edge. */
export function parallelCurvature(slot: ParallelSlot | undefined): number {
  if (!slot || slot.count < 2) return DEFAULT_CURVATURE;
  const step = Math.min(0.2, 1 / slot.count);
  return DEFAULT_CURVATURE + step * slot.index;
}
