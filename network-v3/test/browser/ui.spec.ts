import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const file = (path: string) => readFileSync(new URL(path, import.meta.url));

async function openSample(page: Page, hash = "") {
  await page.route("**/sample/config.json", (route) =>
    route.fulfill({ body: file("../../../network/config.json"), contentType: "application/json" }),
  );
  await page.route("**/data/twitter_mutual2.json", (route) =>
    route.fulfill({ body: file("../../../network/data/twitter_mutual2.json"), contentType: "application/json" }),
  );
  // Profile images in the sample point at long-gone Twitter URLs.
  await page.route("http://a*.twimg.com/**", (route) => route.abort());
  await page.goto(`/?config=sample/config.json${hash}`);
  await page.waitForFunction(() => (window as any).ivis);
}

const visibleNodes = (page: Page) =>
  page.evaluate(() => {
    const { graph, renderer } = (window as any).ivis;
    return graph.filterNodes((key: string) => !renderer.getNodeDisplayData(key).hidden).length;
  });

const pane = (page: Page) => page.locator("#attributepane");

test("fills the panel from config.json and opens the more-information dialog", async ({ page }) => {
  await openSample(page);
  await expect(page.locator("#title")).toHaveText("Twitter Network of @OIIOxford");
  await expect(page.locator("#maintitle img")).toHaveAttribute("alt", "Oxford Internet Institute");
  await expect(page.locator("#legend dd.colours")).toContainText("automatic grouping");
  await page.getByRole("link", { name: "More about this visualisation" }).click();
  await expect(page.locator("#information")).toBeVisible();
  await expect(page.locator("#information")).toContainText("Data and Visualization");
  await page.keyboard.press("Escape");
  await expect(page.locator("#information")).toBeHidden();
});

test("search lists matches, opens the first, and handles regex characters", async ({ page }) => {
  await openSample(page);
  const input = page.getByRole("searchbox");
  await input.fill("oi");
  await expect(page.locator("#search-results")).toContainText("minimum of 3 letters");
  await input.fill("davidundludwig");
  await input.press("Enter");
  await expect(pane(page).locator(".name")).toHaveText("davidundludwig");
  await expect(pane(page).locator(".data")).toContainText("Humboldt University");
  await expect(page).toHaveURL(/#davidundludwig$/);
  await input.fill("(((");
  await input.press("Enter");
  await expect(page.locator("#search-results")).toContainText("No results found.");
});

test("clicking a node shows it with its neighbours; clicking the background resets", async ({ page }) => {
  await openSample(page);
  const total = await visibleNodes(page);
  const { x, y, key, degree } = await page.evaluate(() => {
    const { graph, renderer } = (window as any).ivis;
    const key = graph.nodes().reduce((best: string, k: string) =>
      graph.getNodeAttribute(k, "size") > graph.getNodeAttribute(best, "size") ? k : best,
    );
    const { x, y } = renderer.graphToViewport(graph.getNodeAttributes(key));
    return { x, y, key, degree: graph.neighbors(key).length };
  });
  await page.mouse.click(x, y);
  await expect(pane(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).ivis.state.selected)).toBe(key);
  expect(await visibleNodes(page)).toBe(degree + 1);
  await expect(pane(page).locator(".link li")).toHaveCount(degree);

  await page.mouse.click(1270, 10);
  await expect(pane(page)).toBeHidden();
  expect(await visibleNodes(page)).toBe(total);
});

test("the group selector shows one group's members", async ({ page }) => {
  await openSample(page);
  await page.getByRole("button", { name: "Select Group" }).click();
  const first = page.locator("#group-list button").first();
  await expect(first).toContainText(/Group 1 \(\d+ members\)/);
  const members = Number((await first.textContent())!.match(/\((\d+) members/)![1]);
  await first.click();
  await expect(pane(page).locator(".name")).toHaveText("Group 1");
  await expect(pane(page).locator(".p")).toHaveText("Group Members:");
  expect(await visibleNodes(page)).toBe(members);
  await page.keyboard.press("Escape");
  await expect(pane(page)).toBeHidden();
});

test("#label links open a node, and Back returns to the full network", async ({ page }) => {
  await openSample(page);
  await page.evaluate(() => (window.location.hash = "davidundludwig"));
  await expect(pane(page).locator(".name")).toHaveText("davidundludwig");
  await page.goBack();
  await expect(pane(page)).toBeHidden();
});

test("Back and Forward close and reopen a node, the dialog and the group list", async ({ page }) => {
  await openSample(page);
  await page.evaluate(() => {
    const { graph, ui } = (window as any).ivis;
    ui.openNode(graph.findNode((_: string, a: any) => a.label === "davidundludwig"));
  });
  await expect(pane(page).locator(".name")).toHaveText("davidundludwig");
  await page.goBack();
  await expect(pane(page)).toBeHidden();
  await page.goForward();
  await expect(pane(page).locator(".name")).toHaveText("davidundludwig");

  await page.getByRole("link", { name: "More about this visualisation" }).click();
  await expect(page.locator("#information")).toBeVisible();
  expect(await page.evaluate(() => window.location.hash)).toBe("#information");
  await page.goBack();
  await expect(page.locator("#information")).toBeHidden();
  await expect(pane(page).locator(".name")).toHaveText("davidundludwig");

  await page.evaluate(() => (window.location.hash = "Groups"));
  await expect(page.locator("#group-list")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#group-list")).toBeHidden();
});

test("a label containing a percent sequence survives the round trip through the hash", async ({ page }) => {
  await openSample(page);
  const hash = await page.evaluate(() => {
    const { graph, ui } = (window as any).ivis;
    const key = graph.findNode((_: string, a: any) => a.label === "davidundludwig");
    graph.setNodeAttribute(key, "label", "Rate%20Limit");
    ui.openNode(key);
    return decodeURIComponent(window.location.hash.slice(1));
  });
  expect(hash).toBe("Rate%20Limit");
});

test("a #label in the first URL opens that node on load", async ({ page }) => {
  await openSample(page, "#davidundludwig");
  await expect(pane(page).locator(".name")).toHaveText("davidundludwig");
});

test("hides the more-information link, legend and selectors when config leaves them out", async ({ page }) => {
  await page.route("**/fixtures/plugin-config.json", (route) =>
    route.fulfill({
      body: JSON.stringify({ type: "network", data: "orientation.json", features: { search: false }, logo: { text: "<em>Logo</em> text" } }),
      contentType: "application/json",
    }),
  );
  await page.route("**/orientation.json", (route) =>
    route.fulfill({ body: file("../fixtures/orientation.json"), contentType: "application/json" }),
  );
  await page.goto("/?config=fixtures/plugin-config.json");
  await page.waitForFunction(() => (window as any).ivis);
  await expect(page.locator("#maintitle h1 em")).toHaveText("Logo");
  await expect(page.locator("#moreinformation")).toBeHidden();
  await expect(page.locator("#legend")).toBeHidden();
  await expect(page.locator("#search")).toBeHidden();
  await expect(page.locator("#attributeselect")).toBeHidden();
});

test("on a phone the panel starts folded and can be opened", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSample(page);
  await expect(page.locator("#title")).toBeHidden();
  await page.getByRole("button", { name: "Show panel" }).click();
  await expect(page.locator("#title")).toBeVisible();
});
