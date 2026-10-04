import { test, expect } from '@playwright/test';
import { config } from './support';

// Level 2: the page renders in a real browser, with its components and without errors.
// Soft assertions: one run reports every problem on the page, not just the first one.
test.describe('Level 2: Rendering', () => {
  for (const focus of config.pages) {
    test(`${focus.name} renders without errors`, async ({ page, baseURL }) => {
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('response', (response) => {
        const sameOrigin = new URL(response.url()).origin === new URL(baseURL!).origin;
        if (sameOrigin && response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
      });

      await page.goto(focus.path, { waitUntil: 'load' });

      for (const selector of [...config.requiredSelectors, ...(focus.selectors ?? [])]) {
        await expect.soft(page.locator(selector).first(), `required element "${selector}"`).toBeVisible();
      }
      await expect.soft(page.locator('h1'), 'exactly one H1').toHaveCount(1);

      const text = await page.locator('body').innerText();
      const visiblePlaceholders = config.forbiddenText.filter((forbidden) => text.includes(forbidden));
      expect.soft(visiblePlaceholders, 'placeholder or error text on the page').toEqual([]);

      expect.soft(pageErrors, 'uncaught JavaScript errors').toEqual([]);
      expect.soft(failedRequests, 'failed same-origin requests').toEqual([]);
    });
  }
});
