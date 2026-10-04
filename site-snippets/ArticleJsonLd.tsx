// Only needed if the site doesn't render Article structured data yet.
// Render it inside the article page's component, with values from the Sitecore item's fields.

type ArticleJsonLdProps = {
  headline: string;
  /** Absolute URL of the article's main image. */
  image?: string;
  /** ISO 8601, e.g. the raw value of a Sitecore Date field ("2026-09-24T00:00:00Z"). */
  datePublished: string;
  dateModified?: string;
  authorName: string;
  /** Absolute production URL of the article, same as the canonical. */
  url: string;
};

export function ArticleJsonLd({ headline, image, datePublished, dateModified, authorName, url }: ArticleJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    image: image ? [image] : undefined,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: { '@type': 'Person', name: authorName },
    mainEntityOfPage: url,
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so content can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
