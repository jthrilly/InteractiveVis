import { test, expect } from '@playwright/test';
import { trackErrors, screenshot } from './helpers.js';

test.describe('map interactions', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse-only');

  test('wheel zooms around the cursor, drag pans, dialog opens', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await page.goto('map/index.htm');
    const svg = page.locator('#map svg');
    await expect(page.locator('#map')).toHaveClass(/ready/);
    const vb = async () => (await svg.getAttribute('viewBox')).split(' ').map(Number);
    const start = await vb();

    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -100);
    await expect.poll(async () => (await vb())[2]).toBeLessThan(start[2]);
    const zoomed = await vb();

    await page.mouse.move(600, 600);
    await page.mouse.down();
    await page.mouse.move(700, 650, { steps: 5 });
    await page.mouse.up();
    const panned = await vb();
    expect(panned[0]).toBeLessThan(zoomed[0]);
    expect(panned[2]).toBe(zoomed[2]);
    // A drag must not open the information pane for the region under the cursor
    await expect(page.locator('#chartname')).toHaveText('World');

    await page.locator('#moreinformation a').click();
    await expect(page.locator('#information h3').first()).toHaveText('Data');
    await screenshot(page, testInfo, 'map-dialog');
    await page.mouse.click(5, 5); // backdrop closes it
    await expect(page.locator('#information')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
