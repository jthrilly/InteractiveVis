import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Browsers refuse to load module scripts on file:// pages, which would stop
 * exports with embedded data from opening from disk. The bundle is built as
 * a classic script instead, and its tag loses type="module" and crossorigin
 * (a crossorigin request is blocked on file:// too) and gains defer, which
 * keeps the module tag's run-after-parsing timing.
 */
function classicScript(): Plugin {
  return {
    name: "ivis-classic-script",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html
          .replace(/<script type="module" crossorigin src=/g, "<script defer src=")
          .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href='),
    },
  };
}

/** The build writes into ../network, which also holds the sample configs and data. */
const OUT_DIR = fileURLToPath(new URL("../network/", import.meta.url));

/**
 * ../network keeps files the build doesn't make (config*.json, data/,
 * server/), so only the previous build's hashed bundle is cleared.
 */
function clearOldBundle(): Plugin {
  return {
    name: "ivis-clear-old-bundle",
    apply: "build",
    buildStart: () => rmSync(new URL("../network/assets", import.meta.url), { recursive: true, force: true }),
  };
}

// Relative base so the built folder works from any path on a web server,
// the same way the exported network/ folder always has.
export default defineConfig({
  base: "./",
  plugins: [classicScript(), clearOldBundle()],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: { output: { format: "iife" } },
  },
  // test/browser holds Playwright specs, run with `npm run test:browser`.
  test: { exclude: ["test/browser/**", "node_modules/**"] },
});
