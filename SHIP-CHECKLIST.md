# Ship Checklist: Royal Hair

Run 2026-09-28 against the Master Playbook (Appendix B). ✅ done · ❌ failing (with the fix) ·
⏳ needs the backend (ADR 0002) · N/A doesn't apply. A failing item gets a fix and an owner; it
does not get ticked.

**Verdict: not ready to take real bookings.** The site itself is production-grade (headers, tests,
build, content), but bookings don't reach the salon until the backend exists. The WhatsApp launch
in ADR 0002 option 1 can go live sooner, once the salon's details are in (docs/GO-LIVE-INFO.md).

## Security
- ⏳ RLS / security rules on + tested with a second account: Firestore rules, written with the backend.
- ✅ Built bundle contains no keys: there are no secrets in the app at all; CI runs gitleaks over history.
- ⏳ Rate limits (codes, bookings): server-side, with the backend.
- ⏳ IDOR test (client B can't open client A's visit): today visits are hidden per browser; the real test needs server rules.
- ✅ Errors: visitors see plain messages and a crash screen (`ErrorBoundary`); details go to the console only.
- ✅ CORS / redirects: no API and no redirects today. Revisit with the backend.
- N/A Upload validation: no uploads.
- ✅ `npm audit`: 0 vulnerabilities (28 Sept).
- ✅ **Salon side not reachable on the live site**: a production build leaves `/#/admin` and the demo controls out entirely (only a `VITE_SALON_SIDE=on` demo build has them).
- ⏳ Staff logins and logout that ends the session on the server: Firebase Auth (ADR 0002).
- ⏳ Staging behind auth: a Railway preview environment with a password, when staging exists.

### Perimeter
- ✅ Header config in the repo: `server.mjs` (10 tests in `server.test.ts`).
- ❌ securityheaders.com grade A: can only be run against the live URL. Expected A (all headers present, verified locally). Owner: Calvin, on the first deploy.
- ✅ CSP enforcing, no violations: strict `script-src` with the inline script allowed by hash; checked in the browser, no console errors.
- ✅ Cache-Control route-scoped: hashed assets immutable, photos a week, page revalidated.
- N/A Auth cookies: no cookies today. ⏳ verify flags once Firebase Auth is in.
- ✅ `X-XSS-Protection: 0` (OWASP). Scanners may flag it; that's the documented, correct choice.
- ✅ No dotfiles over HTTP: `server.mjs` refuses them, tested including encoded paths.

### Depth
- ✅ CI secret scan (gitleaks, full history) + SAST (Semgrep): `.github/workflows/ci.yml`. Runs on the first push.
- ⏳ Automated IDOR / protected-route negative tests: with the backend.
- ⏳ Payload validation: with the booking Cloud Function.
- ⏳ Database not publicly reachable, least privilege: Firestore rules.

## Completeness
- ✅ Privacy notice + booking terms, linked in the footer, profile and at booking: **drafts**, to be checked by the owner and someone qualified before launch (docs/GO-LIVE-INFO.md).
- ✅ Loading, empty and error states on every screen: skeletons, empty states, crash screen.
- ❌ **Mobile verified on a real device**: only emulated (320 to 1440 px, no overflow). Fix: Calvin tests the booking flow on a cheap Android and an iPhone on mobile data.
- ❌ SEO five: robots.txt, sitemap, title and description, canonical ✅; Google Search Console, Bing Webmaster and IndexNow need the domain. Also a Google Business Profile per branch. Owner: Calvin at launch.
- ✅ Open Graph tags (absolute URLs from `VITE_SITE_URL`) + favicon. ❌ check a real shared link once the domain is live.
- ❌ Launch marketing: an Instagram/TikTok post and "link in bio" ready. Owner: the salon, with Calvin.
- N/A Mobile app store checklist.
- N/A Payments: nothing is paid online (ADR 0001).

## Deploy safety
- ✅ Env vars: `VITE_SITE_URL` required, the build stops without it; `.env.example` lists names.
- ⏳ Database backups (daily + second provider) and a tested restore.
- ✅ Rollback path: redeploy the previous Railway deployment (docs/RUNBOOK.md).
- ⏳ Migrations reversible: with the backend.

## Quality gates
- ✅ Typecheck, tests, build: green locally; CI runs them on every push.
- ❌ **Lint**: no ESLint yet. Fix: add ESLint + typescript-eslint and a lint step in CI (needs a package install). Owner: Calvin to approve the install.
- ❌ **E2E smoke test** of the core booking against staging: not written. Fix: Playwright test (needs a package install), run in CI against the Railway preview.
- ❌ Lighthouse 90+: not run yet (needs the Lighthouse package or the live URL). Photos are already served at the right size per screen, lazy-loaded, WebP.
- ✅ Inputs labelled, alt text, visible focus, 4.5:1 contrast: checked in earlier passes.

## Operations
- ❌ Error tracking + logs + alerts: none. Fix: Sentry (free tier) wired into `ErrorBoundary`, and Railway log alerts. Owner: Calvin to create the Sentry account.
- ❌ Uptime monitor on `/healthz`: UptimeRobot (free), alerts to Calvin's phone. At launch.
- ❌ Billing alerts on Railway and Firebase. At signup.
- ❌ Monthly dependency update and quarterly restore drill on the calendar.

## Built to last
- ✅ ADRs: 0001 pay at the salon, 0002 backend and hosting (proposed).
- ✅ RUNBOOK.md: top failures with fixes and fallbacks.
- ⏳ RPO/RTO and a second-provider backup.
- ✅ `/healthz` (process up). ⏳ `/readyz` (database reachable) with the backend.
- N/A Idempotency on money: no online money. ⏳ idempotent booking writes with the backend.
- ⏳ Data export and delete flows (Act 843) and ❌ registration with the Data Protection Commission (the salon).
- ⏳ Append-only audit log of staff actions.
- ✅ Domain module, bookings (Phase 15): state machine for visits; double-booking checked at write time with a clean-down gap; ⏳ enforced by the database (slot locks in a transaction); Ghana is UTC+0 with no daylight saving, so local times are stored as-is (revisit if a branch opens abroad).
- ✅ Domain module, health data: allergies asked only when relevant, staff-only; ⏳ access logging.
