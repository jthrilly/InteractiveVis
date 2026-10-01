import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const file = (path: string) => readFileSync(new URL(path, import.meta.url));

// Serves fixture and sample files without copying them into the app.
async function serve(page: Page, routes: Record<string, string>) {
  for (const [pattern, path] of Object.entries(routes)) {
    await page.route(pattern, (route) => route.fulfill({ body: file(path), contentType: "application/json" }));
  }
}

async function viewport(page: Page, node: string) {
  return page.evaluate((key) => {
    const { renderer, graph } = (window as any).ivis;
    return renderer.graphToViewport(graph.getNodeAttributes(key));
  }, node);
}

test("keeps Gephi's orientation: larger y is higher on screen", async ({ page }) => {
  await serve(page, {
    "**/fixtures/orientation-config.json": "../fixtures/orientation-config.json",
    "**/orientation.json": "../fixtures/orientation.json",
  });
  await page.goto("/?config=fixtures/orientation-config.json");
  await page.waitForFunction(() => (window as any).ivis);
  await expect(page).toHaveTitle("Orientation check");

  const top = await viewport(page, "top");
  const bottom = await viewport(page, "bottom");
  const left = await viewport(page, "left");
  const right = await viewport(page, "right");
  expect(top.y).toBeLessThan(bottom.y);
  expect(left.x).toBeLessThan(right.x);

  const types = await page.evaluate(() => {
    const { renderer } = (window as any).ivis;
    return { a: renderer.getEdgeDisplayData("a").type, b: renderer.getEdgeDisplayData("b").type };
  });
  expect(types).toEqual({ a: "arrow", b: "line" });
});

test("renders the OII Twitter sample network", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serve(page, {
    "**/sample/config.json": "../../../network/config.json",
    "**/data/twitter_mutual2.json": "../../../network/data/twitter_mutual2.json",
  });
  await page.goto("/?config=sample/config.json");
  await page.waitForFunction(() => (window as any).ivis);
  expect(await page.evaluate(() => (window as any).ivis.graph.order)).toBe(1064);
  await expect(page.locator("#message")).toBeHidden();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/twitter.png" });
});
