// Entry point: loads the network, renders it with the old viewer's look and
// builds the panels, search, group selector and information pane around it.

import Sigma from "sigma";
import "./style.css";
import { loadNetwork } from "./load";
import { prepareEdges } from "./prepare";
import { sigmaSettings } from "./render";
import { createViewState, makeReducers, setHovered } from "./view";
import { ViewerUI } from "./ui";
import { bindZoomButtons } from "./zoom";

function showError(message: string): void {
  const el = document.getElementById("message");
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
}

function webglAvailable(): boolean {
  const canvas = document.createElement("canvas");
  return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}

async function start(): Promise<void> {
  if (!webglAvailable()) {
    showError("Your browser can't display this network because WebGL is turned off or not supported.");
    return;
  }
  const { config, graph, report } = await loadNetwork();
  if (config.text.title) document.title = config.text.title;
  if (report.skippedEdges || report.duplicateNodes) console.warn("InteractiveVis data issues:", report);
  prepareEdges(graph, config);

  const state = createViewState();
  const container = document.getElementById("sigma-canvas") as HTMLElement;
  const renderer = new Sigma(graph, container, {
    ...sigmaSettings(config),
    ...makeReducers(graph, state, config.hoverBehavior),
  });

  if (config.hoverBehavior !== "default") {
    renderer.on("enterNode", ({ node }) => {
      setHovered(state, graph, node);
      renderer.refresh({ skipIndexation: true });
    });
    renderer.on("leaveNode", () => {
      setHovered(state, graph, null);
      renderer.refresh({ skipIndexation: true });
    });
  }
  bindZoomButtons(renderer);
  const ui = new ViewerUI(config, graph, renderer, state);
  ui.init();

  // Exposed for the browser tests and for debugging from the console.
  Object.assign(window, { ivis: { config, graph, renderer, state, ui } });
}

start().catch((error: unknown) => {
  console.error(error);
  showError(error instanceof Error ? error.message : String(error));
});
