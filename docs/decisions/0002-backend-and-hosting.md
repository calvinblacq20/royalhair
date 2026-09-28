# 0002: Backend and hosting for go-live

Date: 2026-09-28. Status: **proposed**, waiting on Calvin.

## Context

Everything today lives in each visitor's browser (localStorage). That was right for showing the
salon a working demo, but it can't go live as a booking system:

- A client's booking stays on the client's phone. The salon never sees it.
- `/#/admin` has no login. Anyone can open it (today it only shows sample data).
- Sample clients, visits, reviews and the "reset demo" controls ship with every build.
- Receipt and booking numbers are counted per browser, so two desks would issue the same number.
- Double-booking is checked in the browser, not by the database (Playbook Phase 15 asks for a
  database-level guard).

The Bizaro stack is already decided: Firebase (Firestore + Auth) for data and Railway for hosting,
own domain per client (see the Bizaro plan). This ADR applies it to Royal Hair.

## Options

1. **WhatsApp launch first, backend second.** Go live now with the client site only: services and
   prices, branches, hours, and the booking flow's last step sends the booking to the branch's
   WhatsApp as a pre-filled message. The salon side stays off until step 2. No database, no logins,
   nothing to leak. Live in days.
2. **Backend first.** Build the Firebase version before anything goes live: Firestore for branches,
   services, staff, clients, visits, payments and reviews; Firebase Auth for staff (owner, manager,
   front desk, per branch); bookings written through a Cloud Function that takes a slot lock in a
   Firestore transaction (one lock document per staff member per 15 minutes), so double-booking is
   impossible at the database; receipt numbers from a transactional counter; security rules so
   clients only ever read their own visits. Two to three weeks of work.
3. **Both, in that order** (recommended): option 1 this week, option 2 behind it, switching the
   booking step from WhatsApp to the database when staff logins are ready.

## What going live on option 2 needs from Calvin

A Firebase project on the Blaze plan (Cloud Functions need it; free allowance covers this salon)
with billing alerts, a Railway project, the domain, and a decision on client login codes: WhatsApp
Business API or an SMS provider (Hubtel, mNotify, Arkesel) for the one-time codes.

## Consequences

- Option 1 ships the marketing value (prices, branches, WhatsApp) immediately and risks nothing,
  but the salon side, the diary and receipts wait.
- Option 2 is the real product, and brings the security gates with it: security rules tested with
  a second account, rate limits on codes and bookings, server-side receipt numbering, daily backups
  exported to a second provider, and an audit log of staff actions.
- `server.mjs` (security headers, caching, `/healthz`) serves either option on Railway unchanged;
  only the Content-Security-Policy `connect-src` gains the Firebase origins for option 2.
