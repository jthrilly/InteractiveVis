import { test, expect } from '@playwright/test';
import { smokeTestMap, screenshot } from './helpers.js';

test('usmap/ (US counties) renders and is interactive', async ({ page }, testInfo) => {
  // 05119 is stored as "5119" in data.json: exercises the dropped-leading-zero FIPS lookup.
  await smokeTestMap(page, testInfo, {
    folder: 'usmap',
    region: '05119',
    label: 'Pulaski, Arkansas',
    minRegions: 3000,
    highlight: 'rgb(247, 102, 10)',
  });

  // Starts zoomed in on the north-east (data-initial-view)
  await page.reload();
  await expect(page.locator('#map svg')).toHaveAttribute('viewBox', '443 -3 175 110');
  await expect(page.locator('#map')).toHaveClass(/ready/);
  await page.waitForTimeout(600);
  await screenshot(page, testInfo, 'usmap-initial');
  await page.locator('#region-36061').dispatchEvent('click');
  await expect(page.locator('#chartname')).toHaveText('New York, New York');
  await expect(page.locator('#chart .bar-value')).toHaveText('300');
  await expect(page.locator('#attributeText li')).toHaveText(/Tweets about flooding\s*300/);
});
