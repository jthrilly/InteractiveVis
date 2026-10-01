import { defineConfig } from "vite";

// Relative base so the built folder works from any path on a web server,
// the same way the exported network/ folder does today.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
