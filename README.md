# Quality gates for SitecoreAI sites

A Playwright suite that tests the **rendered website**, not the code. It is built around **GitHub** and **Netlify**: on every pull request, GitHub Actions waits for the Netlify Deploy Preview, runs the suite against it, and a required status check blocks the merge when it fails. A nightly run checks production, because content published from SitecoreAI never goes through a PR.

To plug it into your existing SitecoreAI project, copy one folder and one workflow file into your site repo, list your key pages in one JSON file, and set three GitHub settings.

It comes from the talk *"Deploy your SitecoreAI projects with confidence"* (Sitecore User Group Germany, September 2026). <!-- TODO: link the blog post and slides --> This is reference code, not a maintained package: copy it and adapt it.

## Plug it into your project

You need a site repo on GitHub and a Netlify site with Deploy Previews for pull requests.

1. **Copy** `quality-gates/` to your repo root and `ci/quality-gates.yml` to `.github/workflows/`.
2. **Edit `quality-gates/pages.json`:** set `productionUrl`, replace `YOUR-SITE` in `forbiddenHosts` with your Netlify site name, and list 5–10 key pages. Only list `structuredData` types a page really renders.
3. **Run it locally**, then commit, including `package-lock.json`:
   ```sh
   cd quality-gates
   npm install
   npx playwright install chromium
   BASE_URL=https://your-site.netlify.app npx playwright test   # PowerShell: $env:BASE_URL = "..."; npx playwright test
   ```
4. **GitHub** → Settings → Secrets and variables → Actions: secret `NETLIFY_TOKEN` (a Netlify personal access token), variables `NETLIFY_SITE_NAME` (the `<name>` in `<name>.netlify.app`) and `PRODUCTION_URL`.
5. **Netlify:** Deploy Previews must not be password-protected, and turn off the Netlify Drawer on previews (its scripts show up as JS errors).
6. **Make it a gate:** open a PR so the check runs once, then require the status check `quality-gates` in a ruleset on `main`.

Not on Netlify? Replace the "Wait for Netlify Deploy Preview" step in the workflow with whatever gives you the preview URL. The suite only needs `BASE_URL`.

## What it checks

The gates are a ladder. Start at the bottom and climb when a defect slips through.

| Level | File | Checks |
|---|---|---|
| 1. HTTP | `tests/01-http.spec.ts` | Status 200 without redirects, response-time budget, a real 404 for unknown URLs, configured redirects |
| 2. Rendering | `tests/02-rendering.spec.ts` | Required elements visible, exactly one H1, no placeholder or error text, no JS errors, no failed same-origin requests |
| 3. SEO & metadata | `tests/03-seo.spec.ts` | Title, meta description, canonical pointing to **production** (also on previews), no `noindex`, hreflang, Open Graph, pages listed in `sitemap.xml` |
| 4. Structured data | `tests/04-structured-data.spec.ts` | JSON-LD parses, expected schema.org types, required properties, ISO 8601 dates, headline matches the H1, no preview or localhost URLs |

Level 4 is the project-specific level; JSON-LD is just the example. The required properties per type are in `REQUIRED_PROPERTIES` at the top of the file. If your site renders no Article JSON-LD yet, `site-snippets/ArticleJsonLd.tsx` is a minimal component.

## Expect the first run to be red

Get to a green baseline before you make the check required. Typical first findings:

- **Canonical points to the preview host or `localhost`:** build it from the production URL in every environment (on Next.js kits, e.g. set `NEXT_PUBLIC_SITE_URL` for all Netlify deploy contexts).
- **Soft 404:** the not-found page answers 200.
- **`sitemap.xml` fails on previews:** check the SXA site host settings against the hosts you test.
- **Response time over budget:** cold starts on fresh previews. Raise the budget rather than adding retries.

## See it catch a bug

An agent is asked to "show article dates in German format and clean up the duplicated date code". The page shows "24. September 2026" and the diff looks tidy, but the same string now feeds the JSON-LD. Level 4 reports:

```
Article: dates that are not ISO 8601
+   "datePublished = \"24. September 2026\"",
+   "dateModified = \"24. September 2026\"",
```

and the required check blocks the merge.

## `pages.json` reference

| Field | Meaning |
|---|---|
| `productionUrl` | Canonicals must point here, even on previews. |
| `responseTimeBudgetMs` | Maximum response time per page. |
| `notFoundPath` | A path that must answer 404. |
| `redirects` | `{ "from", "to", "status" }` entries to verify. |
| `requiredSelectors` | Selectors visible on every page, e.g. header, main, footer. |
| `forbiddenText` | Placeholder or error texts that must never be visible. |
| `forbiddenHosts` | Substrings that must not appear in JSON-LD. `--<site>.netlify.app` matches Netlify previews but not production. |
| `pages[]` | `name`, `path`, and optionally `selectors`, `hreflang`, `structuredData`, `indexable: false` (skips robots and sitemap checks). |

## License

[MIT](LICENSE)
