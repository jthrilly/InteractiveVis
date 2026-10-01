import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConfigError, normalizeConfig, toEdgeStyle, type RawConfig } from "../src/config";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as RawConfig;

describe("normalizeConfig", () => {
  it("reads the config the Gephi plugin writes", () => {
    const config = normalizeConfig(read("./fixtures/plugin-config.json"));
    expect(config.data).toBe("data.json");
    expect(config.text.title).toBe("Plugin export");
    expect(config.search).toEqual({ enabled: true, fulltext: false });
    expect(config.groupBy).toBeNull();
    expect(config.informationPanel).toEqual({ groupByEdgeDirection: false, imageAttribute: null });
    expect(config.edgeStyle).toBe("curve");
    expect(config.nodeSize).toEqual({ min: 1, max: 7 });
    expect(config.edgeSize).toEqual({ min: 0.2, max: 0.5 });
    expect(config.labels.renderedSizeThreshold).toBe(10);
  });

  it("reads every config shipped with the sigma 0.1 viewer", () => {
    for (const name of ["config.json", "config_fb.json", "config_ukgov.json"]) {
      expect(() => normalizeConfig(read(`../../network/${name}`)), name).not.toThrow();
    }
    const config = normalizeConfig(read("../../network/config.json"));
    expect(config.search.fulltext).toBe(true);
    expect(config.groupBy).toBe("color");
    expect(config.informationPanel.imageAttribute).toBe("Image File");
  });

  it("inverts sigma 0.1 zoom ratios into sigma 3 camera ratios", () => {
    const config = normalizeConfig({ type: "network", sigma: { mouseProperties: { minRatio: 0.5, maxRatio: 10 } } });
    expect(config.camera.minRatio).toBeCloseTo(0.1);
    expect(config.camera.maxRatio).toBeCloseTo(2);
  });

  it("applies the sigma 0.1 defaults to an almost empty config", () => {
    const config = normalizeConfig({ type: "network" });
    expect(config.data).toBe("data.json");
    expect(config.hoverBehavior).toBe("default");
    expect(config.camera.minRatio).toBeCloseTo(0.05);
    expect(config.camera.maxRatio).toBeCloseTo(1 / 0.75);
  });

  it("fills keys missing from a supplied block with sigma 0.1's own defaults, as the old viewer did", () => {
    const config = normalizeConfig({
      type: "network",
      sigma: { drawingProperties: { defaultLabelSize: 20 }, graphProperties: { maxNodeSize: 9 }, mouseProperties: { maxRatio: 10 } },
    });
    expect(config.labels.size).toBe(20);
    expect(config.edgeStyle).toBe("line");
    expect(config.labels.renderedSizeThreshold).toBe(6);
    expect(config.labels.weight).toBe("normal");
    expect(config.nodeSize).toEqual({ min: 0, max: 9 });
    expect(config.edgeSize).toEqual({ min: 0, max: 0 });
    expect(config.camera.minRatio).toBeCloseTo(0.1);
    expect(config.camera.maxRatio).toBeCloseTo(1);
  });

  it("reads sigma 0.1's colour settings", () => {
    expect(normalizeConfig({ type: "network" }).colors).toEqual({ defaultNode: "#aaa", defaultEdge: "#aaa", edgeMode: "source" });
    const config = normalizeConfig({
      type: "network",
      sigma: { drawingProperties: { edgeColor: "default", defaultEdgeColor: "#123", defaultNodeColor: "#456" } },
    });
    expect(config.colors).toEqual({ defaultNode: "#456", defaultEdge: "#123", edgeMode: "default" });
  });

  it("treats false, empty and the plugin's None choices as unset", () => {
    for (const value of [false, "", "None", "None (Default)"]) {
      const config = normalizeConfig({ type: "network", features: { groupSelectorAttribute: value } });
      expect(config.groupBy).toBeNull();
    }
    expect(normalizeConfig({ type: "network", features: { groupSelectorAttribute: "Modularity Class" } }).groupBy).toBe(
      "Modularity Class",
    );
  });

  it("accepts string booleans", () => {
    const config = normalizeConfig({
      type: "network",
      features: { search: "false" },
      search: { fulltext: "true" },
      informationPanel: { groupByEdgeDirection: "true" },
    });
    expect(config.search).toEqual({ enabled: false, fulltext: true });
    expect(config.informationPanel.groupByEdgeDirection).toBe(true);
  });

  it("rejects a config that is not a network", () => {
    expect(() => normalizeConfig({ type: "map" })).toThrow(ConfigError);
  });
});

describe("toEdgeStyle", () => {
  it("maps sigma 0.1 edge types and the new curved arrow", () => {
    expect(toEdgeStyle("line")).toBe("line");
    expect(toEdgeStyle("curve")).toBe("curve");
    expect(toEdgeStyle("arrow")).toBe("arrow");
    expect(toEdgeStyle("curvedArrow")).toBe("curvedArrow");
    expect(toEdgeStyle(undefined)).toBe("curve");
    expect(toEdgeStyle("unknown")).toBe("curve");
  });
});
