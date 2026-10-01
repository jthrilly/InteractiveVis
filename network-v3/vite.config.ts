import { defineConfig } from "vitest/config";

// Relative base so the built folder works from any path on a web server,
// the same way the exported network/ folder does today.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  // test/browser holds Playwright specs, run with `npm run test:browser`.
  test: { exclude: ["test/browser/**", "node_modules/**"] },
});
