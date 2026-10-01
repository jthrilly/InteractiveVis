// Types and normalisation for the config.json written by the sigmaexporter
// Gephi plugin (uk.ac.ox.oii.sigmaexporter.model.ConfigFile) and by hand.
// The file format is unchanged from the sigma.js 0.1 viewer; this module
// only reads it and translates the sigma 0.1 settings to sigma 3 ones.

export type HoverBehavior = "default" | "dim" | "hide";

/** Edge styles accepted in `sigma.drawingProperties.defaultEdgeType`. */
export type EdgeStyle = "line" | "curve" | "arrow" | "curvedArrow";

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

// Defaults match the sigma 0.1 viewer's main.js and ConfigFile.setDefaults().
const DRAWING_DEFAULTS = {
  defaultLabelColor: "#000",
  defaultLabelSize: 14,
  defaultLabelBGColor: "#ddd",
  defaultHoverLabelBGColor: "#002147",
  defaultLabelHoverColor: "#fff",
  labelThreshold: 10,
  defaultEdgeType: "curve",
  fontStyle: "bold",
};
const GRAPH_DEFAULTS = { minNodeSize: 1, maxNodeSize: 7, minEdgeSize: 0.2, maxEdgeSize: 0.5 };
const MOUSE_DEFAULTS = { minRatio: 0.75, maxRatio: 20 };

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

function toHover(value: unknown): HoverBehavior {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return v === "dim" || v === "hide" ? v : "default";
}

export function normalizeConfig(raw: RawConfig): ViewerConfig {
  if (!raw || raw.type !== "network") {
    throw new ConfigError('Invalid configuration: "type" must be "network".');
  }
  const drawing = { ...DRAWING_DEFAULTS, ...(raw.sigma?.drawingProperties ?? {}) };
  const graph = { ...GRAPH_DEFAULTS, ...(raw.sigma?.graphProperties ?? {}) };
  const mouse = { ...MOUSE_DEFAULTS, ...(raw.sigma?.mouseProperties ?? {}) };

  // sigma 0.1 ratios are zoom factors (20 = 20x zoomed in); sigma 3 camera
  // ratios are the inverse (0.05 = 20x zoomed in).
  const minZoom = num(mouse.minRatio, MOUSE_DEFAULTS.minRatio);
  const maxZoom = num(mouse.maxRatio, MOUSE_DEFAULTS.maxRatio);

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
    nodeSize: {
      min: num(graph.minNodeSize, GRAPH_DEFAULTS.minNodeSize),
      max: num(graph.maxNodeSize, GRAPH_DEFAULTS.maxNodeSize),
    },
    edgeSize: {
      min: num(graph.minEdgeSize, GRAPH_DEFAULTS.minEdgeSize),
      max: num(graph.maxEdgeSize, GRAPH_DEFAULTS.maxEdgeSize),
    },
    labels: {
      color: str(drawing.defaultLabelColor, DRAWING_DEFAULTS.defaultLabelColor),
      size: num(drawing.defaultLabelSize, DRAWING_DEFAULTS.defaultLabelSize),
      weight: str(drawing.fontStyle, DRAWING_DEFAULTS.fontStyle),
      background: str(drawing.defaultLabelBGColor, DRAWING_DEFAULTS.defaultLabelBGColor),
      hoverBackground: str(drawing.defaultHoverLabelBGColor, DRAWING_DEFAULTS.defaultHoverLabelBGColor),
      hoverColor: str(drawing.defaultLabelHoverColor, DRAWING_DEFAULTS.defaultLabelHoverColor),
      renderedSizeThreshold: num(drawing.labelThreshold, DRAWING_DEFAULTS.labelThreshold),
    },
    camera: {
      minRatio: maxZoom > 0 ? 1 / maxZoom : 1 / MOUSE_DEFAULTS.maxRatio,
      maxRatio: minZoom > 0 ? 1 / minZoom : 1 / MOUSE_DEFAULTS.minRatio,
    },
  };
}
