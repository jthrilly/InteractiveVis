// Phase 1 entry point: loads the network and renders it with default
// sigma 3 drawing. The panels, search and groups arrive in later phases.

import Sigma from "sigma";
import { loadNetwork } from "./load";
import { sigmaSettings } from "./render";

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

  const container = document.getElementById("sigma-canvas") as HTMLElement;
  const renderer = new Sigma(graph, container, sigmaSettings(config));
  // Exposed for the browser tests and for debugging from the console.
  Object.assign(window, { ivis: { config, graph, renderer } });
}

start().catch((error: unknown) => {
  console.error(error);
  showError(error instanceof Error ? error.message : String(error));
});
