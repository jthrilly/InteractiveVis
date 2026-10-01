import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || join(here, '..', 'screenshots');

/** Collect console errors and uncaught exceptions for the page. */
export function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`);
  });
  return errors;
}

export async function screenshot(page, testInfo, name) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const suffix = testInfo.project.name === 'desktop' ? '' : `-${testInfo.project.name}`;
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}${suffix}.png`) });
}

/**
 * Shared smoke test for the choropleth templates (map/, map_us/, usmap/).
 * region: shape id of a region that has data; label: its data.json label.
 */
export async function smokeTestMap(page, testInfo, { folder, region, label, minRegions, highlight }) {
  const errors = trackErrors(page);
  await page.goto(`${folder}/index.htm`);

  const regions = page.locator('#map svg path.region');
  await expect(regions.first()).toBeAttached();
  expect(await regions.count()).toBeGreaterThanOrEqual(minRegions);
  await expect(page.locator('#map')).toHaveClass(/ready/);

  // Config-driven text and legend
  const config = await (await page.request.get(`${folder}/config.json`)).json();
  await expect(page.locator('#title h2')).toHaveText(config.text.title);
  await expect(page.locator('#legendColors li').first()).toBeVisible();
  await expect(page.locator('#jisc a')).toBeVisible();
  await expect(page.locator('#copyright a[rel=license] img')).toBeVisible();

  // Regions are coloured from the legend scale (not all "no data" grey)
  const fills = await regions.evaluateAll((els) => new Set(els.map((e) => e.getAttribute('fill'))).size);
  expect(fills).toBeGreaterThan(1);

  const target = page.locator(`#region-${region}`);
  // Bring the region into view and away from overlays, then hover it.
  await page.locator('#reset').click();
  await target.scrollIntoViewIfNeeded();
  if (testInfo.project.name === 'desktop') {
    await target.hover({ force: true });
    await expect(page.locator('#tooltip')).toHaveText(label);
    if (highlight) {
      await expect
        .poll(() => target.evaluate((e) => getComputedStyle(e).fill))
        .toBe(highlight);
    }
  }
  await target.dispatchEvent('click');
  await expect(page.locator('#attributepane')).toBeVisible();
  await expect(page.locator('#chartname')).toHaveText(label);
  await page.waitForTimeout(1100); // let the bar animation finish

  await screenshot(page, testInfo, folder);

  // "More information" dialog
  if (config.text.more) {
    await page.locator('#moreinformation a').click();
    await expect(page.locator('dialog#information')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog#information')).toBeHidden();
  }

  // Zoom buttons change the viewBox; reset restores it
  const svg = page.locator('#map svg');
  const before = await svg.getAttribute('viewBox');
  await page.locator('#zoomIn').click();
  await expect(svg).not.toHaveAttribute('viewBox', before);
  await page.locator('#reset').click();

  // Close the information pane
  await page.locator('#attributepane .left-close').click();
  await expect(page.locator('#attributepane')).toBeHidden();

  expect(errors).toEqual([]);
}
