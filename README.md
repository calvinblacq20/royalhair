# Royal Hair Salon & Spa

Booking site and salon app for Royal Hair: barbershop, hair, nails, spa and kids, at West Hills
Mall, Airport and Kumasi. Clients see every price and book a barber or stylist; the salon side
(`/#/admin`) runs the day per branch: diary, walk-ins, clients and hair records, payments taken at
the desk, receipts and reports. Clients never pay online: everything is paid at the salon
([ADR 0001](docs/decisions/0001-pay-at-the-salon.md)).

**Status:** working demo. Data is kept in each browser, so it is **not ready to take real
bookings** until the backend in [ADR 0002](docs/decisions/0002-backend-and-hosting.md) exists.
Launch progress is tracked in [SHIP-CHECKLIST.md](SHIP-CHECKLIST.md); what is still needed from
the salon is in [docs/GO-LIVE-INFO.md](docs/GO-LIVE-INFO.md).

## Stack

Vite 8, React 19, TypeScript (strict), react-router (hash routes), motion, Vitest. No UI kit: the
house design system in `src/styles/`. Production is served by `serve.mjs` / `server.mjs`, a
dependency-free Node server with security headers, route-scoped caching, gzip and `/healthz`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit and server tests
npm run typecheck
```

The salon side is at `/#/admin` (Profile → "Open the salon side" also gets there). It is in
development and demo builds only; a production build leaves it out until staff logins exist.

## Build and serve like production

```bash
VITE_SITE_URL=https://www.example.com npm run build   # stops if VITE_SITE_URL is missing
npm start                                              # serve.mjs: dist/ on $PORT (default 3000)

# The demo shown to the salon, with the salon side included:
VITE_SITE_URL=https://www.example.com VITE_SALON_SIDE=on npm run build
```

## Environment variables

Names only; values live on the host, never in git. See `.env.example`.

| Name | Used for |
|---|---|
| `VITE_SITE_URL` | Live https address, no trailing slash. Link previews, canonical link, robots.txt, sitemap. Build fails without it. |
| `VITE_SALON_SIDE` | `on` only for the demo build: includes the salon side and demo controls. Unset for the live site. |
| `PORT` | Set by Railway. `serve.mjs` falls back to 3000. |

## Deploy (Railway)

Build command `npm run build`, start command `npm start`, health check path `/healthz`. Set
`VITE_SITE_URL` in the service variables and turn on "Wait for CI" so only a green `main` deploys.
Roll back by redeploying the previous deployment from the Railway dashboard.

## Where things are

| Path | What |
|---|---|
| `src/client/` | Client screens: home, explore, booking, visits, receipts, branches, privacy, terms |
| `src/admin/` | Salon screens: today, diary, walk-in, clients, staff, payments, reports, reviews, services, settings |
| `src/lib/` | Pure logic with tests beside it: booking and double-booking guard, visits, receipts, reports |
| `src/data/` | Types, the store, sample data, the salon's default details |
| `scripts/` | Photo pipeline: frames from their videos → upscaled → web sizes |
| `docs/` | PRD, decisions (ADRs), runbook, personal-data inventory, go-live info list, photo sources |
