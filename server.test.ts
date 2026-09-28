import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM module without types, run directly by Node in production
import { cacheControl, createSiteServer, inlineScriptHashes } from "./server.mjs";

const INLINE = "document.documentElement.setAttribute('data-motion','full');";
let base = "";
let close = () => {};

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), "rh-site-"));
  mkdirSync(join(root, "assets"));
  mkdirSync(join(root, "photos"));
  writeFileSync(join(root, "index.html"), `<!doctype html><html><head><script>${INLINE}</script></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`);
  writeFileSync(join(root, "assets", "app.js"), `console.log(${JSON.stringify("x".repeat(4000))});`);
  writeFileSync(join(root, "photos", "cut.webp"), "webp");
  writeFileSync(join(root, ".env"), "SECRET=1");
  const server = createSiteServer(root);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

describe("production server", () => {
  it("sends the security headers on every response, including 404s", async () => {
    for (const path of ["/", "/nope"]) {
      const res = await fetch(base + path);
      expect(res.headers.get("strict-transport-security"), path).toContain("max-age=63072000");
      expect(res.headers.get("x-frame-options"), path).toBe("DENY");
      expect(res.headers.get("x-content-type-options"), path).toBe("nosniff");
      expect(res.headers.get("x-xss-protection"), path).toBe("0");
      expect(res.headers.get("content-security-policy"), path).toContain("frame-ancestors 'none'");
      expect(res.headers.get("x-powered-by"), path).toBeNull();
    }
  });

  it("allows index.html's own inline script by hash and nothing else inline", async () => {
    const csp = (await fetch(base + "/")).headers.get("content-security-policy") ?? "";
    const hash = createHash("sha256").update(INLINE).digest("base64");
    expect(csp).toContain(`script-src 'self' 'sha256-${hash}'`);
    expect(csp).not.toContain("'unsafe-inline' https://fonts.googleapis.com; script");
    expect(csp.match(/script-src[^;]*/)?.[0]).not.toContain("unsafe");
  });

  it("caches hashed build files forever and always revalidates the page", async () => {
    expect((await fetch(base + "/assets/app.js")).headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await fetch(base + "/photos/cut.webp")).headers.get("cache-control")).toBe("public, max-age=604800");
    expect((await fetch(base + "/")).headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(cacheControl("/robots.txt")).toBe("public, max-age=86400");
  });

  it("gzips text for slow connections when the browser accepts it", async () => {
    // fetch() unzips on its own, so read the raw bytes with node:http.
    const { encoding, body } = await new Promise<{ encoding?: string; body: Buffer }>((resolve, reject) => {
      get(base + "/assets/app.js", { headers: { "accept-encoding": "gzip" } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ encoding: res.headers["content-encoding"], body: Buffer.concat(chunks) }));
      }).on("error", reject);
    });
    expect(encoding).toBe("gzip");
    expect(gunzipSync(body).toString()).toContain("console.log");
  });

  it("answers the uptime monitor", async () => {
    const res = await fetch(base + "/healthz");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("never serves dotfiles or anything outside the site, however the path is written", async () => {
    for (const path of ["/.env", "/%2eenv", "/assets/../.env", "/..%2f..%2fetc/passwd", "/photos/..%5c..%5c.env"]) {
      expect((await fetch(base + path)).status, path).toBe(404);
    }
  });

  it("refuses methods other than GET and HEAD", async () => {
    expect((await fetch(base + "/", { method: "POST" })).status).toBe(405);
  });

  it("tags the gzipped and plain copies differently, so caches never mix them up", async () => {
    const plain = await fetch(base + "/assets/app.js", { headers: { "accept-encoding": "identity" } });
    const zipped = await fetch(base + "/assets/app.js", { headers: { "accept-encoding": "gzip" } });
    expect(plain.headers.get("etag")).toBeTruthy();
    expect(zipped.headers.get("etag")).toBe(plain.headers.get("etag")?.replace(/"$/, '-gz"'));
    expect((await fetch(base + "/assets/app.js", { headers: { "accept-encoding": "identity", "if-none-match": zipped.headers.get("etag") ?? "" } })).status).toBe(200);
  });

  it("answers a repeat visit with 304 when nothing changed", async () => {
    const first = await fetch(base + "/");
    const etag = first.headers.get("etag") ?? "";
    expect((await fetch(base + "/", { headers: { "if-none-match": etag } })).status).toBe(304);
  });
});

describe("inline script hashes", () => {
  it("ignores scripts loaded from files", () => {
    expect(inlineScriptHashes('<script src="/a.js"></script>')).toEqual([]);
    expect(inlineScriptHashes("<script>a()</script><script type='module'>b()</script>")).toHaveLength(2);
  });
});
