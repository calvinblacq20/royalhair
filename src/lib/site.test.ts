import { describe, expect, it } from "vitest";
import { robotsTxt, siteUrlProblem, sitemapXml } from "./site";

describe("the live address", () => {
  it("accepts an https address with no path", () => {
    expect(siteUrlProblem("https://www.royalhair.com.gh")).toBeNull();
    expect(siteUrlProblem("https://royalhair.up.railway.app")).toBeNull();
  });

  it("stops the build when it is missing or malformed", () => {
    expect(siteUrlProblem(undefined)).toMatch(/not set/);
    expect(siteUrlProblem("")).toMatch(/not set/);
    expect(siteUrlProblem("http://www.royalhair.com.gh")).toMatch(/https/);
    expect(siteUrlProblem("https://www.royalhair.com.gh/")).toMatch(/trailing slash/);
    expect(siteUrlProblem("https://www.royalhair.com.gh/book")).toMatch(/no path/);
    expect(siteUrlProblem("www.royalhair.com.gh")).toMatch(/https/);
  });
});

describe("files for search engines", () => {
  it("points robots.txt at the sitemap on the live address", () => {
    expect(robotsTxt("https://www.royalhair.com.gh")).toContain("Sitemap: https://www.royalhair.com.gh/sitemap.xml");
    expect(robotsTxt("https://www.royalhair.com.gh")).toContain("Allow: /");
  });

  it("lists the home page in a valid sitemap", () => {
    const xml = sitemapXml("https://www.royalhair.com.gh");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://www.royalhair.com.gh/</loc>");
    expect(xml.match(/<url>/g)).toHaveLength(1);
  });
});
