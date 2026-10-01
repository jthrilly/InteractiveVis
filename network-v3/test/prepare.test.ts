import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../src/config";
import { buildGraph, type RawData } from "../src/data";
import { DEFAULT_CURVATURE, edgeProgram, parallelCurvature, parallelSlots } from "../src/edges";
import { fadeTowards, prepareEdges } from "../src/prepare";
import { createViewState, DIM_COLOR, makeReducers, setHovered } from "../src/view";

const data: RawData = {
  nodes: [
    { id: "a", x: 0, y: 0, size: 1, color: "rgb(200,0,0)" },
    { id: "b", x: 1, y: 0, size: 1, color: "rgb(0,0,200)" },
    { id: "c", x: 0, y: 1, size: 1, color: "rgb(0,200,0)" },
    { id: "d", x: 1, y: 1, size: 1, color: "rgb(0,0,0)" },
  ],
  edges: [
    { id: "ab1", source: "a", target: "b" },
    { id: "ab2", source: "a", target: "b" },
    { id: "ab3", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "cb", source: "c", target: "b" },
    { id: "cd", source: "c", target: "d", directed: false },
  ],
};

function graphFor(style: string) {
  const config = normalizeConfig({ type: "network", sigma: { drawingProperties: { defaultEdgeType: style } } });
  const { graph } = buildGraph(data, config);
  prepareEdges(graph, config);
  return graph;
}

describe("edge programs", () => {
  it("curves parallel edges whatever the style, keeping arrows", () => {
    expect(edgeProgram("line", undefined, true)).toBe("curve");
    expect(edgeProgram("arrow", true, true)).toBe("curvedArrow");
    expect(edgeProgram("arrow", false, true)).toBe("curve");
    expect(edgeProgram("curve", undefined, true)).toBe("curve");
  });

  it("treats only same-direction duplicates as parallel", () => {
    const slots = parallelSlots([
      { key: "1", source: "a", target: "b" },
      { key: "2", source: "a", target: "b" },
      { key: "3", source: "b", target: "a" },
    ]);
    expect(slots.get("1")).toEqual({ index: -0.5, count: 2 });
    expect(slots.get("2")).toEqual({ index: 0.5, count: 2 });
    expect(slots.get("3")).toEqual({ index: 0, count: 1 });
    const graph = graphFor("arrow");
    expect(graph.getEdgeAttribute("ab1", "type")).toBe("curvedArrow");
    expect(graph.getEdgeAttribute("bc", "type")).toBe("arrow");
    expect(graph.getEdgeAttribute("cd", "type")).toBe("line");
  });

  it("gives each parallel edge its own curvature", () => {
    const graph = graphFor("curve");
    const curvatures = ["ab1", "ab2", "ab3"].map((e) => graph.getEdgeAttribute(e, "curvature"));
    expect(new Set(curvatures).size).toBe(3);
    expect(graph.getEdgeAttribute("bc", "curvature")).toBe(DEFAULT_CURVATURE);
    expect(parallelCurvature(undefined)).toBe(DEFAULT_CURVATURE);
  });

  it("fades edge colours towards the background without touching Gephi columns", () => {
    expect(fadeTowards("rgb(0,0,0)", "#ffffff", 0.5)).toBe("rgb(128,128,128)");
    expect(fadeTowards("#ff0000", "#000000", 0)).toBe("rgb(255,0,0)");
    expect(fadeTowards("rgba(0,0,0,0)", "#ffffff", 0.5)).toBe("rgb(255,255,255)");
    expect(fadeTowards("rgba(0,0,0,0.5)", "#ffffff", 0)).toBe("rgb(128,128,128)");
    const graph = graphFor("curve");
    expect(graph.getEdgeAttribute("cd", "color")).not.toBe("rgb(0,200,0)");
    expect(graph.getEdgeAttribute("cd", "attributes")).toEqual({});
  });
});

describe("hover reducers", () => {
  const graph = graphFor("curve");
  const node = (key: string) => ({ ...graph.getNodeAttributes(key), x: 0, y: 0, size: 1, label: key, color: "red" }) as never;
  const edge = (key: string) => ({ ...graph.getEdgeAttributes(key), size: 1, color: "red" }) as never;

  it("changes nothing while no node is hovered or behaviour is default", () => {
    const state = createViewState();
    const dim = makeReducers(graph, state, "dim");
    expect(dim.nodeReducer!("d", node("d"))).toEqual(node("d"));
    setHovered(state, graph, "a");
    const plain = makeReducers(graph, state, "default");
    expect(plain.nodeReducer!("d", node("d"))).toEqual(node("d"));
  });

  it("dims everything outside the hovered node's neighbourhood", () => {
    const state = createViewState();
    const { nodeReducer, edgeReducer } = makeReducers(graph, state, "dim");
    setHovered(state, graph, "b");
    expect(nodeReducer!("a", node("a")).color).toBe("red");
    expect(nodeReducer!("c", node("c")).color).toBe("red");
    expect(nodeReducer!("d", node("d")).color).toBe(DIM_COLOR);
    expect(edgeReducer!("ab1", edge("ab1")).color).toBe("red");
    expect(edgeReducer!("cd", edge("cd")).color).toBe(DIM_COLOR);
  });

  it("hides everything outside the neighbourhood, and restores it on leave", () => {
    const state = createViewState();
    const { nodeReducer, edgeReducer } = makeReducers(graph, state, "hide");
    setHovered(state, graph, "a");
    expect(nodeReducer!("c", node("c")).hidden).toBe(true);
    expect(edgeReducer!("bc", edge("bc")).hidden).toBe(true);
    expect(nodeReducer!("b", node("b")).hidden).toBeFalsy();
    setHovered(state, graph, null);
    expect(nodeReducer!("c", node("c")).hidden).toBeFalsy();
  });
});

describe("hide keeps edges between two neighbours, as sigma 0.1 did", () => {
  it("hides only edges with an end outside the neighbourhood", () => {
    const triangle: RawData = {
      nodes: ["a", "b", "c", "d"].map((id) => ({ id })),
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "ac", source: "a", target: "c" },
        { id: "bc", source: "b", target: "c" },
        { id: "cd", source: "c", target: "d" },
      ],
    };
    const { graph } = buildGraph(triangle, normalizeConfig({ type: "network" }));
    const state = createViewState();
    const { edgeReducer } = makeReducers(graph, state, "hide");
    setHovered(state, graph, "a");
    const edge = (key: string) => edgeReducer!(key, { ...graph.getEdgeAttributes(key) } as never);
    expect(edge("bc").hidden).toBeFalsy();
    expect(edge("cd").hidden).toBe(true);
  });
});
