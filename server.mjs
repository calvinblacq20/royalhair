// Production server for the built site (dist/). No dependencies. `npm start` runs serve.mjs, which
// calls createSiteServer; this file only exports, so tests can import it without starting anything.
//
// It adds what a static host would otherwise leave out: security headers on every response, a
// Content-Security-Policy that allows index.html's own inline script by hash (and nothing else
// inline), route-scoped caching, gzip for slow connections, and /healthz for the uptime monitor.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
};
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt", ".xml"]);

/** SHA-256 hashes of every inline <script> in index.html, in CSP form. */
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    hashes.push(`'sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}'`);
  }
  return hashes;
}

export function securityHeaders(scriptHashes) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(" ")}`.trim(),
    // motion writes inline style attributes; Google Fonts serves the stylesheet.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    // Add the backend's origins here when it exists (e.g. Firestore, Firebase Auth).
    "connect-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
    // OWASP: 0. The browser XSS auditor is gone and caused leaks; CSP is the protection.
    "X-XSS-Protection": "0",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/** Route-scoped caching: hashed build files forever, photos for a week, the page itself always revalidated. */
export function cacheControl(path) {
  if (path.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (path.startsWith("/photos/") || path.startsWith("/brand/")) return "public, max-age=604800";
  if (path === "/robots.txt" || path === "/sitemap.xml" || path === "/site.webmanifest") return "public, max-age=86400";
  return "public, max-age=0, must-revalidate";
}

/** Loads dist/ into memory once: the whole site is a few MB, and this keeps every request a lookup. */
function loadSite(root) {
  const files = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const url = "/" + relative(root, full).split(sep).join("/");
        const ext = extname(name).toLowerCase();
        const body = readFileSync(full);
        const etag = `"${createHash("sha1").update(body).digest("base64url").slice(0, 16)}"`;
        const gz = COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body, { level: 9 }) : null;
        // The gzipped copy is a different representation of the file, so it gets its own tag.
        files.set(url, { body, gz, type: TYPES[ext] ?? "application/octet-stream", etag, gzEtag: gz ? etag.replace(/"$/, '-gz"') : null });
      }
    }
  };
  walk(root);
  return files;
}

export function createSiteServer(root) {
  const files = loadSite(root);
  const index = files.get("/index.html");
  if (!index) throw new Error(`No index.html in ${root}. Run \`npm run build\` first.`);
  const headers = securityHeaders(inlineScriptHashes(index.body.toString("utf8")));
  const notFound = Buffer.from('<!doctype html><meta charset="utf-8"><title>Not found</title><p>This page doesn\'t exist. <a href="/">Go to Royal Hair</a></p>');

  return createServer((req, res) => {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }

    if (path === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("ok");
      return;
    }

    // No dotfiles (.env, .git) and no climbing out of dist/, whatever the encoding.
    const clean = normalize(path).split(sep).join("/");
    const segments = clean.split("/").filter(Boolean);
    const file = segments.some((s) => s.startsWith(".") || s === "..") ? undefined : files.get(clean === "/" ? "/index.html" : clean);

    if (!file) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : notFound);
      return;
    }

    const gzip = Boolean(file.gz) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
    const etag = gzip ? file.gzEtag : file.etag;
    res.setHeader("Cache-Control", cacheControl(clean));
    res.setHeader("ETag", etag);
    res.setHeader("Vary", "Accept-Encoding");
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304).end();
      return;
    }
    const body = gzip ? file.gz : file.body;
    res.writeHead(200, { "Content-Type": file.type, "Content-Length": body.length, ...(gzip ? { "Content-Encoding": "gzip" } : {}) });
    res.end(req.method === "HEAD" ? undefined : body);
  });
}
