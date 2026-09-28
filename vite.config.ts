import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { robotsTxt, siteUrlProblem, sitemapXml } from "./src/lib/site";

/** robots.txt and sitemap.xml need the live address, so they are written at build time. */
function seoFiles(siteUrl: string): Plugin {
  return {
    name: "seo-files",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt(siteUrl) });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml(siteUrl) });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const siteUrl = loadEnv(mode, process.cwd(), "VITE_").VITE_SITE_URL ?? "";
  // Fail the build loudly rather than ship link previews and a sitemap pointing nowhere.
  const problem = command === "build" ? siteUrlProblem(siteUrl) : null;
  if (problem) throw new Error(`${problem}. See .env.example.`);
  return {
    plugins: [react(), seoFiles(siteUrl)],
    server: { port: 5173 },
  };
});
