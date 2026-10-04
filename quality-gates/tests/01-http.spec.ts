import { test, expect } from '@playwright/test';
import { config } from './support';

// Level 1: the cheapest gate. No browser, just HTTP requests against real URLs.
test.describe('Level 1: HTTP', () => {
  for (const focus of config.pages) {
    test(`${focus.name} answers 200 within budget`, async ({ request }) => {
      const started = Date.now();
      // No redirect following: a focus page that suddenly redirects is a finding, not a pass.
      const response = await request.get(focus.path, { maxRedirects: 0 });
      const elapsed = Date.now() - started;

      expect(response.status(), `status of ${focus.path}`).toBe(200);
      expect(response.headers()['content-type'] ?? '', 'content type').toContain('text/html');
      expect(elapsed, `response time of ${focus.path} in ms`).toBeLessThanOrEqual(config.responseTimeBudgetMs);
    });
  }

  test('unknown URL answers a real 404', async ({ request }) => {
    const response = await request.get(config.notFoundPath, { maxRedirects: 0 });
    expect(response.status(), 'soft 404: the not-found page must not answer 200').toBe(404);
  });

  for (const redirect of config.redirects) {
    test(`redirect ${redirect.from} -> ${redirect.to}`, async ({ request }) => {
      const response = await request.get(redirect.from, { maxRedirects: 0 });
      expect(response.status(), `status of ${redirect.from}`).toBe(redirect.status);

      const location = new URL(response.headers()['location'] ?? '', response.url()).pathname;
      expect(location, `redirect target of ${redirect.from}`).toBe(new URL(redirect.to, response.url()).pathname);
    });
  }
});
