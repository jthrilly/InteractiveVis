import { test, expect } from '@playwright/test';
import { smokeTestMap } from './helpers.js';

test('map/ (world literacy) renders and is interactive', async ({ page }, testInfo) => {
  await smokeTestMap(page, testInfo, {
    folder: 'map',
    region: 'BR',
    label: 'Brazil',
    minRegions: 200,
    highlight: 'rgb(247, 102, 10)',
  });

  // onLoad datapoint ("world") is shown on load
  await page.reload();
  await expect(page.locator('#chartname')).toHaveText('World');
  await expect(page.locator('#chart .bar')).toHaveCount(3);
  await expect(page.locator('#chart .bar-value').first()).toHaveText('82%');

  // Alternative statistics menu switches the legend and recolours the map
  const fillBefore = await page.locator('#region-IN').getAttribute('fill');
  await page.locator('#legendtitle button').click();
  await page.locator('#altStats a', { hasText: 'Female Literacy' }).click();
  await expect(page.locator('#legendtitle')).toHaveText('Female Literacy');
  await expect(page.locator('#altStats')).toBeHidden();
  expect(await page.locator('#region-IN').getAttribute('fill')).not.toBe(fillBefore);
});
