import { test, expect } from '@playwright/test';
import { attrs, config, openLean, withoutTrailingSlash } from './support';

// Level 3: SEO & metadata. Invisible in a visual review, expensive when it breaks.
test.describe('Level 3: SEO & metadata', () => {
  for (const focus of config.pages) {
    test(`${focus.name} has complete metadata`, async ({ page }) => {
      await openLean(page, focus.path);

      const title = (await page.title()).trim();
      expect.soft(title, '<title>').not.toBe('');
      expect.soft(title.length, '<title> length').toBeLessThanOrEqual(70);

      const descriptions = await attrs(page, 'meta[name="description"]', 'content');
      expect.soft(descriptions, 'exactly one meta description').toHaveLength(1);
      expect.soft(descriptions[0]?.trim(), 'meta description text').toBeTruthy();

      // The canonical points to production, also on a preview: otherwise previews compete with the live site.
      const canonicals = await attrs(page, 'link[rel="canonical"]', 'href');
      expect.soft(canonicals, 'exactly one canonical').toHaveLength(1);
      expect.soft(withoutTrailingSlash(canonicals[0] ?? ''), 'canonical URL').toBe(
        withoutTrailingSlash(new URL(focus.path, config.productionUrl).href),
      );

      if (focus.indexable !== false) {
        // Only the meta tag: Netlify itself sends X-Robots-Tag: noindex on Deploy Previews.
        const robots = (await attrs(page, 'meta[name="robots"]', 'content')).join(',');
        expect.soft(robots, 'meta robots').not.toContain('noindex');
      }

      for (const lang of focus.hreflang ?? []) {
        const hrefs = await attrs(page, `link[rel="alternate"][hreflang="${lang}"]`, 'href');
        expect.soft(hrefs, `hreflang="${lang}"`).toHaveLength(1);
      }

      const ogTitles = await attrs(page, 'meta[property="og:title"]', 'content');
      expect.soft(ogTitles[0]?.trim(), 'og:title').toBeTruthy();
      const ogImages = await attrs(page, 'meta[property="og:image"]', 'content');
      expect.soft(ogImages[0] ?? '', 'og:image is an absolute https URL').toMatch(/^https:\/\//);
    });
  }

  test('sitemap.xml lists every indexable focus page', async ({ request }) => {
    const readLocs = async (sitemapPath: string): Promise<string[]> => {
      const response = await request.get(sitemapPath);
      expect(response.status(), `status of ${sitemapPath}`).toBe(200);
      const xml = await response.text();
      const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => new URL(match[1]).pathname);
      // A sitemap index points to further sitemaps: follow them one level deep.
      return xml.includes('<sitemapindex') ? (await Promise.all(locs.map(readLocs))).flat() : locs;
    };

    const listed = (await readLocs('/sitemap.xml')).map(withoutTrailingSlash);
    const missing = config.pages
      .filter((focus) => focus.indexable !== false)
      .map((focus) => focus.path)
      .filter((focusPath) => !listed.includes(withoutTrailingSlash(focusPath)));
    expect(missing, 'focus pages missing in sitemap.xml').toEqual([]);
  });
});
