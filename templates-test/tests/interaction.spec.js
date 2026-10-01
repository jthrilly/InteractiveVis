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

  test('two-finger pinch zooms around the gesture midpoint', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto('map/index.htm');
    await expect(page.locator('#map')).toHaveClass(/ready/);
    await page.locator('#attributepane .left-close').click();

    const svg = page.locator('#map svg');
    const vb = async () => (await svg.getAttribute('viewBox')).split(' ').map(Number);
    // Map coordinate under a screen point for the current viewBox
    const toMap = (x, y) =>
      svg.evaluate((s, [x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(s.getScreenCTM().inverse());
        return [p.x, p.y];
      }, [x, y]);

    const mid = { x: 760, y: 420 }; // off-centre, so a centre-anchored zoom would fail
    const anchorBefore = await toMap(mid.x, mid.y);
    const start = await vb();

    const cdp = await context.newCDPSession(page);
    const touch = (type, d) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints:
          type === 'touchEnd'
            ? []
            : [
                { x: mid.x - d, y: mid.y, id: 1 },
                { x: mid.x + d, y: mid.y, id: 2 },
              ],
      });
    await touch('touchStart', 30);
    for (let d = 40; d <= 150; d += 10) await touch('touchMove', d);
    await touch('touchEnd', 0);

    const end = await vb();
    expect(end[2]).toBeLessThan(start[2] / 2); // spread fingers 5x: zoomed in
    const anchorAfter = await toMap(mid.x, mid.y);
    // The map point under the gesture midpoint stays put (within ~1% of the visible width)
    expect(Math.abs(anchorAfter[0] - anchorBefore[0])).toBeLessThan(end[2] * 0.01);
    expect(Math.abs(anchorAfter[1] - anchorBefore[1])).toBeLessThan(end[3] * 0.01);
    // A pinch is not a tap: no region was opened
    await expect(page.locator('#attributepane')).toBeHidden();
    expect(errors).toEqual([]);
    await context.close();
  });
});
