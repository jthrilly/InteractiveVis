import { readFileSync } from "node:fs";
import { MultiGraph } from "graphology";
import { parse as parseGexf } from "graphology-gexf/node";
import { describe, expect, it } from "vitest";
import { normalizeConfig, type RawConfig } from "../src/config";
import { buildGraph, computeGroups, makeScaler, rawDataFromGexfGraph, type RawData } from "../src/data";
import { edgeProgram } from "../src/edges";

const text = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const json = <T>(path: string) => JSON.parse(text(path)) as T;
const pluginConfig = normalizeConfig(json<RawConfig>("./fixtures/plugin-config.json"));

describe("makeScaler", () => {
  it("matches sigma 0.1: divide by the largest size, map onto [min, max]", () => {
    const scale = makeScaler(20, { min: 1, max: 7 });
    expect(scale(20)).toBeCloseTo(7);
    expect(scale(10)).toBeCloseTo(4);
    expect(scale(0)).toBeCloseTo(1);
  });

  it("leaves sizes alone when min and max are 0, and fixes them when equal", () => {
    expect(makeScaler(20, { min: 0, max: 0 })(13)).toBe(13);
    expect(makeScaler(20, { min: 3, max: 3 })(13)).toBe(3);
  });
});

describe("buildGraph on a plugin export", () => {
  const { graph, report } = buildGraph(json<RawData>("./fixtures/plugin-data.json"), pluginConfig);

  it("keeps ids, labels, colours and Gephi coordinates unchanged", () => {
    expect(graph.order).toBe(3);
    const alpha = graph.getNodeAttributes("0");
    expect(alpha.label).toBe("Alpha");
    expect(alpha.color).toBe("rgb(255,0,0)");
    expect([alpha.x, alpha.y]).toEqual([-120.5, 80.25]);
  });

  it("rescales node and edge sizes like sigma 0.1", () => {
    expect(graph.getNodeAttribute("1", "size")).toBeCloseTo(7);
    expect(graph.getNodeAttribute("0", "size")).toBeCloseTo(4);
    expect(graph.getNodeAttribute("0", "rawSize")).toBe(10);
    expect(graph.getEdgeAttribute("1", "size")).toBeCloseTo(0.5);
  });

  it("keeps user columns nested, so reserved sigma names never reach the renderer", () => {
    const alpha = graph.getNodeAttributes("0") as unknown as Record<string, unknown>;
    expect(alpha.type).toBeUndefined();
    expect(alpha.hidden).toBeUndefined();
    expect(graph.getNodeAttribute("0", "attributes")).toEqual({ "Modularity Class": "1", type: "person", hidden: "yes" });
  });

  it("keeps both directions of a mutual tie and drops edges to missing nodes", () => {
    expect(graph.size).toBe(3);
    expect(graph.hasEdge("0") && graph.hasEdge("1")).toBe(true);
    expect(report).toEqual({ skippedEdges: 1, duplicateNodes: 0 });
    expect(graph.inNeighbors("0")).toEqual(["1"]);
    expect(graph.outNeighbors("0")).toEqual(["1"]);
  });

  it("reads the optional directed flag", () => {
    expect(graph.getEdgeAttribute("2", "directed")).toBe(false);
    expect(graph.getEdgeAttribute("0", "directed")).toBeUndefined();
    expect(graph.getEdgeAttribute("2", "attributes")).toEqual({ since: "2012" });
  });

  it("colours uncoloured edges like their source node, as sigma 0.1 did", () => {
    const data = json<RawData>("./fixtures/plugin-data.json");
    delete data.edges[0].color;
    expect(buildGraph(data, pluginConfig).graph.getEdgeAttribute("0", "color")).toBe("rgb(255,0,0)");
  });

  it("groups by the chosen column, or by colour", () => {
    const byColumn = computeGroups(graph, "Modularity Class");
    expect(byColumn.by).toBe("Modularity Class");
    expect(Object.fromEntries(byColumn.groups)).toEqual({ "1": ["0", "1"], "2": ["2"] });
    const byColour = computeGroups(graph, "color");
    expect(Object.fromEntries(byColour.groups)).toEqual({ "rgb(255,0,0)": ["0"], "rgb(0,0,255)": ["1", "2"] });
  });

  it("falls back to colour when no node has the chosen column", () => {
    expect(computeGroups(graph, "Label").by).toBe("color");
  });
});

describe("buildGraph on the sample networks", () => {
  it("loads the OII Twitter network", () => {
    const config = normalizeConfig(json<RawConfig>("../../network/config.json"));
    const data = json<RawData>("../../network/data/twitter_mutual2.json");
    const { graph, report } = buildGraph(data, config);
    expect(graph.order).toBe(1064);
    expect(graph.size + report.skippedEdges).toBe(10503);
    graph.forEachNode((_key, attrs) => {
      expect(attrs.size).toBeGreaterThanOrEqual(1);
      expect(attrs.size).toBeLessThanOrEqual(7);
    });
    const node = graph.getNodeAttributes("n98");
    expect(node.attributes["Image File"]).toMatch(/^http/);
    expect(computeGroups(graph, config.groupBy!).groups.size).toBeGreaterThan(1);
  });

  it("loads the UK government network", () => {
    const config = normalizeConfig(json<RawConfig>("../../network/config_ukgov.json"));
    const { graph } = buildGraph(json<RawData>("../../network/data/ukgov3.json"), config);
    expect(graph.order).toBeGreaterThan(0);
    expect(graph.size).toBeGreaterThan(0);
  });

  it("loads a GEXF file through the same path", () => {
    const parsed = parseGexf(MultiGraph, text("../../network/data/facebook.gexf"));
    const { graph, report } = buildGraph(rawDataFromGexfGraph(parsed), pluginConfig);
    expect(graph.order).toBe(parsed.order);
    expect(graph.size).toBe(parsed.size);
    expect(report.skippedEdges).toBe(0);
    graph.forEachNode((_key, attrs) => {
      expect(Number.isFinite(attrs.x) && Number.isFinite(attrs.y)).toBe(true);
      expect(attrs.attributes).not.toHaveProperty("x");
    });
  });
});

describe("edgeProgram", () => {
  it("draws arrows only where the export does not say the edge is undirected", () => {
    expect(edgeProgram("arrow", undefined)).toBe("arrow");
    expect(edgeProgram("arrow", true)).toBe("arrow");
    expect(edgeProgram("arrow", false)).toBe("line");
    expect(edgeProgram("curvedArrow", false)).toBe("curve");
    expect(edgeProgram("curve", true)).toBe("curve");
  });
});
