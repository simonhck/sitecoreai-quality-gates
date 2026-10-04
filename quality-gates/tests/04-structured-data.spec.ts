import { test, expect } from '@playwright/test';
import { config, flattenJsonLd, openLean, typesOf, type JsonLdNode } from './support';

// Our definition of "complete" per schema.org type. Google marks most of these as recommended,
// not required; the point of the gate is that the team decides once and the pipeline enforces it.
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Organization: ['name', 'url', 'logo'],
  WebSite: ['name', 'url'],
  WebPage: ['name', 'url'],
  Person: ['name'],
  Article: ['headline', 'image', 'datePublished', 'author'],
  NewsArticle: ['headline', 'image', 'datePublished', 'author'],
  BlogPosting: ['headline', 'image', 'datePublished', 'author'],
  BreadcrumbList: ['itemListElement'],
  Event: ['name', 'startDate', 'location'],
  FAQPage: ['mainEntity'],
};
const ARTICLE_TYPES = ['Article', 'NewsArticle', 'BlogPosting'];
const DATE_PROPERTIES = ['datePublished', 'dateModified', 'startDate', 'endDate'];

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);
const isIsoDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

// Level 4: project-specific validations. Here: the JSON-LD structured data rendered on each page.
test.describe('Level 4: Structured data', () => {
  for (const focus of config.pages.filter((p) => p.structuredData?.length)) {
    test(`${focus.name} has valid structured data`, async ({ page }) => {
      await openLean(page, focus.path);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();

      // 1. Every block is valid JSON. Hard assertion: nothing below makes sense otherwise.
      const nodes: JsonLdNode[] = [];
      const invalid: string[] = [];
      blocks.forEach((block, index) => {
        try {
          nodes.push(...flattenJsonLd(JSON.parse(block)));
        } catch (error) {
          invalid.push(`block ${index + 1}: ${(error as Error).message} in ${block.slice(0, 120)}...`);
        }
      });
      expect(invalid, 'JSON-LD blocks that are not valid JSON').toEqual([]);

      for (const type of focus.structuredData!) {
        // 2. The expected types are there, exactly once.
        const matches = nodes.filter((node) => typesOf(node).includes(type));
        expect.soft(matches.length, `number of ${type} nodes`).toBe(1);
        const node = matches[0];
        if (!node) continue;

        // 3. Required properties are present and not empty.
        const missing = (REQUIRED_PROPERTIES[type] ?? []).filter((property) => isEmpty(node[property]));
        expect.soft(missing, `${type}: missing or empty properties`).toEqual([]);

        // 4. Dates are ISO 8601, not whatever the UI displays.
        const badDates = DATE_PROPERTIES.filter((property) => node[property] !== undefined && !isIsoDate(node[property]))
          .map((property) => `${property} = ${JSON.stringify(node[property])}`);
        expect.soft(badDates, `${type}: dates that are not ISO 8601`).toEqual([]);

        // 5. The data agrees with what the page shows.
        if (ARTICLE_TYPES.includes(type)) {
          // textContent, not innerText: innerText applies CSS text-transform (uppercase headlines).
          const h1s = await page.locator('h1').allTextContents();
          if (h1s.length === 1) {
            expect.soft(normalizeText(String(node.headline ?? '')), `${type}: headline matches the H1`).toBe(
              normalizeText(h1s[0]),
            );
          }
        }
      }

      // 6. No preview or local hosts leaked into the data.
      const leakedHosts = config.forbiddenHosts.filter((host) => blocks.some((block) => block.includes(host)));
      expect.soft(leakedHosts, 'preview/local hosts in structured data').toEqual([]);
    });
  }
});
