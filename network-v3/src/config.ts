// Types and normalisation for the config.json written by the sigmaexporter
// Gephi plugin (uk.ac.ox.oii.sigmaexporter.model.ConfigFile) and by hand.
// The file format is unchanged from the sigma.js 0.1 viewer; this module
// only reads it and translates the sigma 0.1 settings to sigma 3 ones.

export type HoverBehavior = "default" | "dim" | "hide";

/** Edge styles accepted in `sigma.drawingProperties.defaultEdgeType`. */
export type EdgeStyle = "line" | "curve" | "arrow" | "curvedArrow";

/** sigma 0.1 `edgeColor`: which colour an edge without its own colour takes. */
export type EdgeColorMode = "source" | "target" | "default";

/** config.json exactly as written today. Every key may be missing. */
export interface RawConfig {
  type?: string;
  version?: string;
  data?: string;
  logo?: { file?: string; link?: string; text?: string };
  text?: { title?: string; intro?: string; more?: string };
  legend?: { nodeLabel?: string; edgeLabel?: string; colorLabel?: string };
  features?: {
    search?: boolean | string;
    hoverBehavior?: string;
    groupSelectorAttribute?: string | boolean;
  };
  search?: { fulltext?: boolean | string };
  informationPanel?: {
    groupByEdgeDirection?: boolean | string;
    imageAttribute?: string | boolean;
  };
  sigma?: {
    drawingProperties?: Record<string, unknown>;
    graphProperties?: Record<string, unknown>;
    mouseProperties?: Record<string, unknown>;
  };
}

export interface SizeRange {
  min: number;
  max: number;
}

/** Settings the new viewer actually uses, with defaults applied. */
export interface ViewerConfig {
  data: string;
  logo: { file: string; link: string; text: string };
  text: { title: string; intro: string; more: string };
  legend: { nodeLabel: string; edgeLabel: string; colorLabel: string };
  search: { enabled: boolean; fulltext: boolean };
  hoverBehavior: HoverBehavior;
  /** Node attribute to group by, "color" for node colour, or null when the selector is off. */
  groupBy: string | null;
  informationPanel: { groupByEdgeDirection: boolean; imageAttribute: string | null };
  edgeStyle: EdgeStyle;
  colors: { defaultNode: string; defaultEdge: string; edgeMode: EdgeColorMode };
  nodeSize: SizeRange;
  edgeSize: SizeRange;
  labels: {
    color: string;
    size: number;
    weight: string;
    background: string;
    hoverBackground: string;
    hoverColor: string;
    renderedSizeThreshold: number;
  };
  camera: { minRatio: number; maxRatio: number };
}

// When a whole block is missing, the sigma 0.1 viewer's main.js supplied
// these (ConfigFile.setDefaults() in the plugin writes the same values).
const MAINJS_DRAWING = {
  defaultLabelColor: "#000",
  defaultLabelSize: 14,
  defaultLabelBGColor: "#ddd",
  defaultHoverLabelBGColor: "#002147",
  defaultLabelHoverColor: "#fff",
  labelThreshold: 10,
  defaultEdgeType: "curve",
  fontStyle: "bold",
};
const MAINJS_GRAPH = { minNodeSize: 1, maxNodeSize: 7, minEdgeSize: 0.2, maxEdgeSize: 0.5 };
const MAINJS_MOUSE = { minRatio: 0.75, maxRatio: 20 };

// When a block is present, main.js passed it to sigma 0.1 as it was, so
// keys missing from it took sigma 0.1's own defaults.
const SIGMA01_DRAWING = {
  defaultLabelColor: "#000",
  defaultLabelSize: 12,
  defaultLabelBGColor: "#fff",
  defaultHoverLabelBGColor: "#fff",
  defaultLabelHoverColor: "#000",
  labelThreshold: 6,
  defaultEdgeType: "line",
  fontStyle: "",
  edgeColor: "source",
  defaultEdgeColor: "#aaa",
  defaultNodeColor: "#aaa",
};
const SIGMA01_GRAPH = { minNodeSize: 0, maxNodeSize: 0, minEdgeSize: 0, maxEdgeSize: 0 };
const SIGMA01_MOUSE = { minRatio: 1, maxRatio: 32 };

function settingsBlock(block: Record<string, unknown> | undefined, whenMissing: object, sigmaDefaults: object): Record<string, unknown> {
  return block && typeof block === "object" ? { ...sigmaDefaults, ...block } : { ...sigmaDefaults, ...whenMissing };
}

export class ConfigError extends Error {}

/** The plugin writes some booleans as strings ("true"), so accept both. */
export function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false" || v === "") return false;
  }
  return fallback;
}

/** `false`, "", "None" and missing all mean "not set". */
function optionalName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "" || v.toLowerCase() === "false" || v.toLowerCase().startsWith("none")) return null;
  return v;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function toEdgeStyle(value: unknown): EdgeStyle {
  switch (typeof value === "string" ? value.toLowerCase() : "") {
    case "line":
      return "line";
    case "arrow":
      return "arrow";
    case "curvedarrow":
    case "curved-arrow":
      return "curvedArrow";
    default:
      return "curve";
  }
}

function toEdgeColorMode(value: unknown): EdgeColorMode {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return v === "target" || v === "default" ? v : "source";
}

function toHover(value: unknown): HoverBehavior {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return v === "dim" || v === "hide" ? v : "default";
}

export function normalizeConfig(raw: RawConfig): ViewerConfig {
  if (!raw || raw.type !== "network") {
    throw new ConfigError('Invalid configuration: "type" must be "network".');
  }
  const drawing = settingsBlock(raw.sigma?.drawingProperties, MAINJS_DRAWING, SIGMA01_DRAWING);
  const graph = settingsBlock(raw.sigma?.graphProperties, MAINJS_GRAPH, SIGMA01_GRAPH);
  const mouse = settingsBlock(raw.sigma?.mouseProperties, MAINJS_MOUSE, SIGMA01_MOUSE);

  // sigma 0.1 ratios are zoom factors (20 = 20x zoomed in); sigma 3 camera
  // ratios are the inverse (0.05 = 20x zoomed in).
  const minZoom = num(mouse.minRatio, SIGMA01_MOUSE.minRatio);
  const maxZoom = num(mouse.maxRatio, SIGMA01_MOUSE.maxRatio);

  return {
    data: str(raw.data, "data.json"),
    logo: {
      file: str(raw.logo?.file, ""),
      link: str(raw.logo?.link, ""),
      text: str(raw.logo?.text, ""),
    },
    text: {
      title: str(raw.text?.title, ""),
      intro: str(raw.text?.intro, ""),
      more: str(raw.text?.more, ""),
    },
    legend: {
      nodeLabel: str(raw.legend?.nodeLabel, ""),
      edgeLabel: str(raw.legend?.edgeLabel, ""),
      colorLabel: str(raw.legend?.colorLabel, ""),
    },
    search: {
      enabled: toBool(raw.features?.search, true),
      fulltext: toBool(raw.search?.fulltext, false),
    },
    hoverBehavior: toHover(raw.features?.hoverBehavior),
    groupBy: optionalName(raw.features?.groupSelectorAttribute),
    informationPanel: {
      groupByEdgeDirection: toBool(raw.informationPanel?.groupByEdgeDirection, false),
      imageAttribute: optionalName(raw.informationPanel?.imageAttribute),
    },
    edgeStyle: toEdgeStyle(drawing.defaultEdgeType),
    colors: {
      defaultNode: str(drawing.defaultNodeColor, SIGMA01_DRAWING.defaultNodeColor),
      defaultEdge: str(drawing.defaultEdgeColor, SIGMA01_DRAWING.defaultEdgeColor),
      edgeMode: toEdgeColorMode(drawing.edgeColor),
    },
    nodeSize: {
      min: num(graph.minNodeSize, SIGMA01_GRAPH.minNodeSize),
      max: num(graph.maxNodeSize, SIGMA01_GRAPH.maxNodeSize),
    },
    edgeSize: {
      min: num(graph.minEdgeSize, SIGMA01_GRAPH.minEdgeSize),
      max: num(graph.maxEdgeSize, SIGMA01_GRAPH.maxEdgeSize),
    },
    labels: {
      color: str(drawing.defaultLabelColor, SIGMA01_DRAWING.defaultLabelColor),
      size: num(drawing.defaultLabelSize, SIGMA01_DRAWING.defaultLabelSize),
      weight: str(drawing.fontStyle, SIGMA01_DRAWING.fontStyle).trim() || "normal",
      background: str(drawing.defaultLabelBGColor, SIGMA01_DRAWING.defaultLabelBGColor),
      hoverBackground: str(drawing.defaultHoverLabelBGColor, SIGMA01_DRAWING.defaultHoverLabelBGColor),
      hoverColor: str(drawing.defaultLabelHoverColor, SIGMA01_DRAWING.defaultLabelHoverColor),
      renderedSizeThreshold: num(drawing.labelThreshold, SIGMA01_DRAWING.labelThreshold),
    },
    camera: {
      minRatio: maxZoom > 0 ? 1 / maxZoom : 1 / SIGMA01_MOUSE.maxRatio,
      maxRatio: minZoom > 0 ? 1 / minZoom : 1 / SIGMA01_MOUSE.minRatio,
    },
  };
}
