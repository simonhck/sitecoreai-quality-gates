import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export type FocusPage = {
  /** Shown in test names and failure messages. */
  name: string;
  /** Path relative to BASE_URL, e.g. "/en/news/my-article". */
  path: string;
  /** Selectors that must be visible on this page, on top of requiredSelectors. */
  selectors?: string[];
  /** hreflang values that must be present, e.g. ["en", "de", "x-default"]. */
  hreflang?: string[];
  /** schema.org types that must be present exactly once, e.g. ["Article", "BreadcrumbList"]. */
  structuredData?: string[];
  /** false for pages that are meant to be noindex: skips the robots and sitemap checks. */
  indexable?: boolean;
};

export type GateConfig = {
  /** Canonical URLs must point here, even when the gates run against a preview. */
  productionUrl: string;
  responseTimeBudgetMs: number;
  notFoundPath: string;
  redirects: { from: string; to: string; status: number }[];
  requiredSelectors: string[];
  /** Placeholder and error texts that must never be visible on a page. */
  forbiddenText: string[];
  /** Hosts that must not leak into structured data (preview, local). */
  forbiddenHosts: string[];
  pages: FocusPage[];
};

export const config: GateConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'pages.json'), 'utf8'),
);

/**
 * Opens a page without images, fonts and media. The metadata checks don't need them,
 * and they are the slowest and least predictable part of a page load.
 */
export async function openLean(page: Page, urlPath: string) {
  await page.route('**/*', (route) =>
    ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
  );
  return page.goto(urlPath, { waitUntil: 'load' });
}

/** All values of an attribute for a selector. Never waits, so a missing tag fails fast instead of timing out. */
export function attrs(page: Page, selector: string, attribute: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((elements, name) => elements.map((element) => element.getAttribute(name) ?? ''), attribute);
}

export const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export type JsonLdNode = { '@type'?: string | string[]; [property: string]: unknown };

/** Flattens top-level arrays and @graph into a flat list of nodes. Nested nodes (e.g. an Article's publisher) stay nested. */
export function flattenJsonLd(value: unknown): JsonLdNode[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    return node['@graph'] ? flattenJsonLd(node['@graph']) : [node];
  }
  return [];
}

export function typesOf(node: JsonLdNode): string[] {
  const type = node['@type'];
  return Array.isArray(type) ? type : type ? [type] : [];
}
