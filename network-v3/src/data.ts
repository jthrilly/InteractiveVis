// Builds a graphology graph from the data.json written by the sigmaexporter
// Gephi plugin (uk.ac.ox.oii.sigmaexporter.SigmaExporter), or from a GEXF
// file. The data.json format is unchanged from the sigma.js 0.1 viewer.

import { MultiDirectedGraph } from "graphology";
import type { SizeRange, ViewerConfig } from "./config";

/** A value the plugin writes into `attributes`; it writes strings, hand-made files may not. */
export type AttributeValue = string | number | boolean | null;

export interface RawNode {
  id: string | number;
  label?: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  attributes?: Record<string, AttributeValue>;
  [key: string]: unknown;
}

export interface RawEdge {
  id?: string | number;
  source: string | number;
  target: string | number;
  label?: string;
  size?: number;
  color?: string;
  /** Optional, added by newer plugin versions. Missing means "use the configured edge style". */
  directed?: boolean | string;
  attributes?: Record<string, AttributeValue>;
  [key: string]: unknown;
}

export interface RawData {
  nodes: RawNode[];
  edges: RawEdge[];
}

export interface NodeAttributes {
  label: string;
  x: number;
  y: number;
  /** Display size, rescaled the way sigma 0.1 did it. */
  size: number;
  /** Size as exported, kept for reference. */
  rawSize: number;
  color: string;
  /** User columns from Gephi. Kept nested so names like "type" or "hidden" never reach sigma. */
  attributes: Record<string, AttributeValue>;
}

export interface EdgeAttributes {
  label: string;
  size: number;
  rawSize: number;
  color: string;
  /** true/false when the export says so, undefined when it doesn't. */
  directed?: boolean;
  attributes: Record<string, AttributeValue>;
}

export type IVGraph = MultiDirectedGraph<NodeAttributes, EdgeAttributes>;

export interface BuildReport {
  /** Edges dropped because an endpoint is missing. */
  skippedEdges: number;
  /** Nodes dropped because their id was already used. */
  duplicateNodes: number;
}

const DEFAULT_COLOR = "rgb(102,102,102)";

/**
 * sigma 0.1 rescaling (sigma.js `_core.graph.rescale`): sizes are divided by
 * the largest size, then mapped onto [min, max]. Both 0 leaves sizes as-is;
 * min == max makes every element that size.
 */
export function makeScaler(largest: number, range: SizeRange): (size: number) => number {
  if (!range.min && !range.max) return (size) => size;
  if (range.min === range.max) return () => range.max;
  const ratio = (range.max - range.min) / (largest || 1);
  return (size) => size * ratio + range.min;
}

function finite(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function parseDirected(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function largestSize(items: { size?: unknown }[]): number {
  let largest = 0;
  for (const item of items) largest = Math.max(largest, finite(item.size, 0));
  return largest;
}

export function buildGraph(
  data: RawData,
  config: Pick<ViewerConfig, "nodeSize" | "edgeSize">,
): { graph: IVGraph; report: BuildReport } {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('Invalid data: expected an object with "nodes" and "edges" arrays.');
  }
  const graph: IVGraph = new MultiDirectedGraph();
  const report: BuildReport = { skippedEdges: 0, duplicateNodes: 0 };

  const nodeScale = makeScaler(largestSize(data.nodes), config.nodeSize);
  for (const node of data.nodes) {
    const key = String(node.id);
    if (graph.hasNode(key)) {
      report.duplicateNodes++;
      continue;
    }
    const rawSize = finite(node.size, 1);
    graph.addNode(key, {
      label: node.label != null ? String(node.label) : key,
      // Gephi's y axis points up, and so does sigma 3's: no flip needed.
      x: finite(node.x, 0),
      y: finite(node.y, 0),
      size: nodeScale(rawSize),
      rawSize,
      color: typeof node.color === "string" && node.color ? node.color : DEFAULT_COLOR,
      attributes: { ...(node.attributes ?? {}) },
    });
  }

  const edgeScale = makeScaler(largestSize(data.edges), config.edgeSize);
  for (const edge of data.edges) {
    const source = String(edge.source);
    const target = String(edge.target);
    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      report.skippedEdges++;
      continue;
    }
    const rawSize = finite(edge.size, 1);
    const attributes: EdgeAttributes = {
      label: edge.label != null ? String(edge.label) : "",
      size: edgeScale(rawSize),
      rawSize,
      // sigma 0.1 drew uncoloured edges in their source node's colour.
      color: typeof edge.color === "string" && edge.color ? edge.color : graph.getNodeAttribute(source, "color"),
      attributes: { ...(edge.attributes ?? {}) },
    };
    const directed = parseDirected(edge.directed);
    if (directed !== undefined) attributes.directed = directed;

    const key = edge.id != null ? String(edge.id) : undefined;
    if (key !== undefined && !graph.hasEdge(key)) graph.addEdgeWithKey(key, source, target, attributes);
    else graph.addEdge(source, target, attributes);
  }

  return { graph, report };
}

// Attributes graphology-gexf sets from the GEXF structure rather than from user columns.
const GEXF_NODE_KEYS = new Set(["label", "x", "y", "z", "size", "color", "shape", "thickness"]);
const GEXF_EDGE_KEYS = new Set(["label", "weight", "size", "color", "shape", "thickness", "type"]);

function splitAttributes(attrs: Record<string, unknown>, reserved: Set<string>): Record<string, AttributeValue> {
  const out: Record<string, AttributeValue> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (reserved.has(name)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      out[name] = value as AttributeValue;
    } else {
      out[name] = JSON.stringify(value);
    }
  }
  return out;
}

/**
 * Converts a graph parsed by graphology-gexf into the data.json shape, so
 * GEXF and JSON go through the same buildGraph path. Parse GEXF into a
 * mixed MultiGraph: GEXF files can declare undirected edges.
 */
export function rawDataFromGexfGraph(parsed: {
  forEachNode(cb: (key: string, attrs: Record<string, unknown>) => void): void;
  forEachEdge(
    cb: (key: string, attrs: Record<string, unknown>, source: string, target: string, sa: unknown, ta: unknown, undirected: boolean) => void,
  ): void;
}): RawData {
  const nodes: RawNode[] = [];
  const edges: RawEdge[] = [];
  parsed.forEachNode((key, attrs) => {
    nodes.push({
      id: key,
      label: attrs.label != null ? String(attrs.label) : undefined,
      x: finite(attrs.x, 0),
      y: finite(attrs.y, 0),
      size: finite(attrs.size, 1),
      color: typeof attrs.color === "string" ? attrs.color : undefined,
      attributes: splitAttributes(attrs, GEXF_NODE_KEYS),
    });
  });
  parsed.forEachEdge((key, attrs, source, target, _sa, _ta, undirected) => {
    edges.push({
      id: key,
      source,
      target,
      label: attrs.label != null ? String(attrs.label) : undefined,
      size: finite(attrs.weight ?? attrs.size, 1),
      color: typeof attrs.color === "string" ? attrs.color : undefined,
      directed: !undirected,
      attributes: splitAttributes(attrs, GEXF_EDGE_KEYS),
    });
  });
  return { nodes, edges };
}

/**
 * Groups node keys for the group selector. `groupBy` is a node attribute
 * name or "color". When no node carries the attribute (for example an old
 * export naming a column the plugin skipped), grouping falls back to colour,
 * which is what the sigma 0.1 viewer always did.
 */
export function computeGroups(graph: IVGraph, groupBy: string): { by: string; groups: Map<string, string[]> } {
  const byColor = groupBy.toLowerCase() === "color" || groupBy.toLowerCase() === "colour";
  const groups = new Map<string, string[]>();
  if (!byColor) {
    graph.forEachNode((key, attrs) => {
      const value = attrs.attributes[groupBy];
      if (value === undefined || value === null || value === "") return;
      const name = String(value);
      const members = groups.get(name);
      if (members) members.push(key);
      else groups.set(name, [key]);
    });
    if (groups.size > 0) return { by: groupBy, groups };
  }
  graph.forEachNode((key, attrs) => {
    const members = groups.get(attrs.color);
    if (members) members.push(key);
    else groups.set(attrs.color, [key]);
  });
  return { by: "color", groups };
}
