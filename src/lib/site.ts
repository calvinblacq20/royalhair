/* The live address and the files built from it (used by vite.config.ts at build time). */

/** Why `url` can't be the live address, or null when it can: https, a host, no path or trailing slash. */
export function siteUrlProblem(url: string | undefined): string | null {
  if (!url) return "VITE_SITE_URL is not set";
  if (!/^https:\/\/[^/\s]+$/.test(url)) return `VITE_SITE_URL must be https with no path or trailing slash, like https://www.royalhair.com.gh (got "${url}")`;
  return null;
}

export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

/** Hash routing leaves the home page as the one indexable URL; everything else lives after the #. */
export function sitemapXml(siteUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc></url>\n</urlset>\n`;
}
