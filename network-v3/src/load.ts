// Loads config.json and the network data in the browser. Exports made with
// the plugin's "open from disk" option embed both files in index.html as
// <script type="application/json" id="ivis-config"> and id="ivis-data",
// because browsers block fetch() on file:// pages.

import { parse as parseGexf } from "graphology-gexf/browser";
import { MultiGraph } from "graphology";
import { normalizeConfig, type RawConfig, type ViewerConfig } from "./config";
import { buildGraph, rawDataFromGexfGraph, type BuildReport, type IVGraph, type RawData } from "./data";

export const INLINE_CONFIG_ID = "ivis-config";
export const INLINE_DATA_ID = "ivis-data";

function inlineJson<T>(id: string): T | null {
  const el = document.getElementById(id);
  return el?.textContent ? (JSON.parse(el.textContent) as T) : null;
}

/** `?config=other.json` picks a different config, as in the sigma 0.1 viewer. */
export function configUrl(search = window.location.search): string {
  return new URLSearchParams(search).get("config") || "config.json";
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return response.text();
}

export function isGexf(path: string): boolean {
  return /\.(gexf|xml)(\?|#|$)/i.test(path);
}

export async function loadNetwork(): Promise<{ config: ViewerConfig; graph: IVGraph; report: BuildReport }> {
  const rawConfig = inlineJson<RawConfig>(INLINE_CONFIG_ID) ?? (JSON.parse(await fetchText(configUrl())) as RawConfig);
  const config = normalizeConfig(rawConfig);

  let data = inlineJson<RawData>(INLINE_DATA_ID);
  if (!data) {
    const text = await fetchText(config.data);
    data = isGexf(config.data) ? rawDataFromGexfGraph(parseGexf(MultiGraph, text)) : (JSON.parse(text) as RawData);
  }
  const { graph, report } = buildGraph(data, config);
  return { config, graph, report };
}
