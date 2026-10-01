import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

// `npm run test:browser` builds ../network first. This mimics the plugin's
// "embed data in index.html" option and opens the result straight from disk.
const dist = new URL("../../../network/", import.meta.url);
const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

function embed(json: string): string {
  return json.replace(/<\//g, "<\\/");
}

test("an export with embedded data opens from a file:// URL", async ({ page }) => {
  test.skip(!existsSync(new URL("index.html", dist)), "run `npm run build` first");
  const html = readFileSync(new URL("index.html", dist), "utf8").replace(
    "</head>",
    `<script type="application/json" id="ivis-config">${embed(fixture("orientation-config.json"))}</script>\n` +
      `<script type="application/json" id="ivis-data">${embed(fixture("orientation.json"))}</script>\n</head>`,
  );
  const file = new URL("offline-test.html", dist);
  writeFileSync(file, html);
  try {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(file.pathname).href);
    await page.waitForFunction(() => (window as any).ivis);
    expect(await page.evaluate(() => (window as any).ivis.graph.order)).toBe(4);
    await expect(page).toHaveTitle("Orientation check");
    expect(errors).toEqual([]);
  } finally {
    rmSync(file, { force: true });
  }
});
