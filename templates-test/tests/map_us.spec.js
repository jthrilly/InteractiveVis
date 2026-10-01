import { test, expect } from '@playwright/test';
import { smokeTestMap } from './helpers.js';

test('map_us/ (US states election) renders and is interactive', async ({ page }, testInfo) => {
  await smokeTestMap(page, testInfo, {
    folder: 'map_us',
    region: 'PA',
    label: 'Pennsylvania',
    minRegions: 48,
    highlight: 'rgb(247, 102, 10)',
  });

  await page.reload();
  // No onLoad datapoint: pane starts hidden
  await expect(page.locator('#attributepane')).toBeHidden();
  await page.locator('#region-PA').dispatchEvent('click');
  // Bars (ObamaPer / RomneyPer), text stats and rightPanelText
  await expect(page.locator('#chart .bar-value')).toHaveText(['49.48%', '50.52%']);
  await expect(page.locator('#attributeText li').first()).toContainText('Obama');
  await expect(page.locator('#attributeText p')).toHaveText("Twitter references to candidates' names.");

  // Three alternative statistics in the menu
  await page.locator('#legendtitle button').click();
  await expect(page.locator('#altStats a')).toHaveCount(3);
  await page.locator('#altStats a', { hasText: 'Romney vs Ryan' }).click();
  await expect(page.locator('#legendColors li')).toHaveCount(2);
});
