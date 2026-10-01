import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

test.describe('keyboard and screen-reader access', () => {
  test('map/: regions are named buttons; Tab, Enter and Space open the pane', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('map/index.htm');
    await expect(page.locator('#map')).toHaveClass(/ready/);

    const buttons = page.locator('#map svg path[role=button][tabindex="0"]');
    expect(await buttons.count()).toBeGreaterThan(200);
    await expect(page.locator('#region-BR')).toHaveAttribute('aria-label', 'Brazil');
    // Regions without data are not exposed
    expect(await page.locator('#map svg path:not(.has-data)[tabindex]').count()).toBe(0);

    // The first Tab stop is the alphabetically first region, with a visible focus style
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('role', 'button');
    const firstLabel = await focused.getAttribute('aria-label');
    const labels = await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(firstLabel).toBe([...labels].sort((a, b) => a.localeCompare(b))[0]);
    expect(await focused.evaluate((e) => getComputedStyle(e).strokeWidth)).toBe('2.5px');

    await page.keyboard.press('Enter');
    await expect(page.locator('#chartname')).toHaveText(firstLabel);

    await page.keyboard.press('Tab');
    const second = await page.locator(':focus').getAttribute('aria-label');
    await page.keyboard.press(' ');
    await expect(page.locator('#chartname')).toHaveText(second);

    // Accessible names via the accessibility tree
    await expect(page.getByRole('button', { name: 'Brazil', exact: true })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('usmap/: counties are not tab stops; the region finder reaches them', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('usmap/index.htm');
    await expect(page.locator('#map')).toHaveClass(/ready/);
    expect(await page.locator('#map svg path[tabindex]').count()).toBe(0);
    expect(await page.locator('#regionlist option').count()).toBeGreaterThan(3000);

    const before = await page.locator('#map svg').getAttribute('viewBox');
    const search = page.getByLabel('Find a region');
    await search.focus();
    await search.pressSequentially('Pulaski, Arkansas');
    await search.press('Enter');
    await expect(page.locator('#chartname')).toHaveText('Pulaski, Arkansas');
    await expect(page.locator('#region-05119')).toHaveClass(/selected/);
    await expect(page.locator('#map svg')).not.toHaveAttribute('viewBox', before);

    // Unknown names are flagged, not silently accepted
    await search.fill('Nowhere, Atlantis');
    await search.press('Enter');
    await expect(search).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#chartname')).toHaveText('Pulaski, Arkansas');
    expect(errors).toEqual([]);
  });
});
