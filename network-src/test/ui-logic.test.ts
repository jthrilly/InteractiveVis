import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../src/config";
import { buildGraph, type RawData } from "../src/data";
import { findGroup, listGroups } from "../src/groups";
import { neighborsByDirection, allNeighbors } from "../src/neighbors";
import { searchNodes } from "../src/search";
import { clearSelection, createViewState, makeReducers, selectGroup, selectNode } from "../src/view";

const data: RawData = {
  nodes: [
    { id: "a", label: "Alice (admin)", color: "rgb(1,1,1)", attributes: { team: "Class 10", city: "Oxford" } },
    { id: "b", label: "bob+1", color: "rgb(1,1,1)", attributes: { team: "Class 2" } },
    { id: "c", label: "Carol", color: "rgb(2,2,2)", attributes: { team: "Class 2", city: "Cambridge" } },
    { id: "d", label: "Dave", color: "rgb(2,2,2)", attributes: {} },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "a" },
    { source: "a", target: "c" },
    { source: "d", target: "a" },
  ],
};
const config = normalizeConfig({ type: "network" });
const { graph } = buildGraph(data, config);

describe("searchNodes", () => {
  it("matches labels as plain text, so regex characters are safe", () => {
    expect(searchNodes(graph, "(admin", { fulltext: false }).map((h) => h.key)).toEqual(["a"]);
    expect(searchNodes(graph, "b+1", { fulltext: false }).map((h) => h.key)).toEqual(["b"]);
    expect(searchNodes(graph, "CAROL", { fulltext: false }).map((h) => h.key)).toEqual(["c"]);
  });

  it("searches attribute values only with fulltext", () => {
    expect(searchNodes(graph, "oxford", { fulltext: false })).toEqual([]);
    expect(searchNodes(graph, "oxford", { fulltext: true }).map((h) => h.key)).toEqual(["a"]);
  });

  it("matches whole labels for #links", () => {
    expect(searchNodes(graph, "carol", { fulltext: false, exact: true }).map((h) => h.key)).toEqual(["c"]);
    expect(searchNodes(graph, "car", { fulltext: false, exact: true })).toEqual([]);
  });
});

describe("listGroups", () => {
  it("names colour groups Group 1, Group 2 in data order", () => {
    const groups = listGroups(graph, "color");
    expect(groups.map((g) => [g.name, g.color, g.members])).toEqual([
      ["Group 1", "rgb(1,1,1)", ["a", "b"]],
      ["Group 2", "rgb(2,2,2)", ["c", "d"]],
    ]);
  });

  it("names attribute groups by value, sorted naturally, skipping nodes without one", () => {
    const groups = listGroups(graph, "team");
    expect(groups.map((g) => [g.name, g.members])).toEqual([
      ["Class 2", ["b", "c"]],
      ["Class 10", ["a"]],
    ]);
    expect(findGroup(groups, "class 10")?.members).toEqual(["a"]);
  });
});

describe("neighbour lists", () => {
  it("splits mutual, incoming and outgoing links", () => {
    expect(neighborsByDirection(graph, "a")).toEqual({ mutual: ["b"], incoming: ["d"], outgoing: ["c"] });
  });

  it("counts the other end of an undirected edge as mutual", () => {
    const { graph: g } = buildGraph(
      {
        nodes: [{ id: "x", label: "X" }, { id: "y", label: "Y" }, { id: "z", label: "Z" }],
        edges: [{ source: "x", target: "y", directed: false }, { source: "z", target: "x" }],
      },
      config,
    );
    expect(neighborsByDirection(g, "x")).toEqual({ mutual: ["y"], incoming: ["z"], outgoing: [] });
    expect(neighborsByDirection(g, "y")).toEqual({ mutual: ["x"], incoming: [], outgoing: [] });
  });

  it("lists every neighbour once, sorted by label", () => {
    expect(allNeighbors(graph, "a")).toEqual(["b", "c", "d"]);
  });
});

describe("selection reducers", () => {
  const node = (key: string) => ({ ...graph.getNodeAttributes(key), x: 0, y: 0 }) as never;
  const edge = (key: string) => ({ ...graph.getEdgeAttributes(key) }) as never;

  it("shows only the selected node and its neighbours, and highlights it", () => {
    const state = createViewState();
    const { nodeReducer, edgeReducer } = makeReducers(graph, state, "default");
    selectNode(state, graph, "c");
    expect(nodeReducer!("c", node("c"))).toMatchObject({ highlighted: true, forceLabel: true });
    expect(nodeReducer!("a", node("a")).hidden).toBeFalsy();
    expect(nodeReducer!("b", node("b")).hidden).toBe(true);
    const ab = graph.edges("a", "b")[0];
    const ac = graph.edges("a", "c")[0];
    expect(edgeReducer!(ab, edge(ab)).hidden).toBe(true);
    expect(edgeReducer!(ac, edge(ac)).hidden).toBeFalsy();
  });

  it("shows only group members, and everything again once cleared", () => {
    const state = createViewState();
    const { nodeReducer } = makeReducers(graph, state, "default");
    selectGroup(state, "Group 2", ["c", "d"]);
    expect(nodeReducer!("a", node("a")).hidden).toBe(true);
    expect(nodeReducer!("d", node("d")).hidden).toBeFalsy();
    clearSelection(state);
    expect(nodeReducer!("a", node("a")).hidden).toBeFalsy();
  });
});
