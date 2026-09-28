# Runbook

Symptoms → check → fix → verify → fallback. Severity: **S1** clients can't book or the site is
down; **S2** something is wrong but bookings still reach the salon; **S3** cosmetic.

Items marked *(backend)* apply once ADR 0002 option 2 is live.

## Site down or blank (S1)
- **Check:** the uptime monitor alert; open `/healthz` (should say `ok`); Railway deploy logs.
- **Fix:** if the last deploy broke it, redeploy the previous deployment in Railway. If Railway is
  down, wait it out and post on the salon's Instagram and WhatsApp status.
- **Verify:** `/healthz` returns ok; the home page loads on a phone on mobile data.
- **Fallback:** the salon takes bookings on WhatsApp as it always has.

## Bookings not reaching the salon (S1)
- **Check:** make a test booking for a quiet slot. *(backend)* Firebase console → Functions logs
  for `createBooking` errors; Firestore usage limits; the security-rules deny log.
- **Fix:** roll back the last deploy or rules change; if a quota is hit, raise it (billing alerts
  should have warned first).
- **Verify:** the test booking appears in the diary; cancel it.
- **Fallback:** put the WhatsApp booking message back on the home page until fixed.

## Wrong price, hours or phone number on the site (S2)
- **Check:** Settings (salon, branches, hours) and Services & prices in the salon side.
- **Fix:** correct it there; it shows immediately. If a branch number changed, also update
  Google Business Profile, Instagram and TikTok bios.
- **Verify:** open the page as a client on a phone.

## Link preview or Google result looks wrong (S3)
- **Check:** `VITE_SITE_URL` on Railway matches the domain exactly (https, no trailing slash).
- **Fix:** correct it and redeploy (the build writes robots.txt, the sitemap and the preview tags).
- **Verify:** share the link in WhatsApp; check Search Console for the sitemap.

## A staff member leaves (S2) *(backend)*
- **Fix:** Staff → untick "Taking bookings" so no new bookings go to them; move their future
  visits in the diary; disable their login in Firebase Auth the same day.
- **Verify:** they no longer appear when booking; their login is refused.

## Before every deploy
Tests and CI green on `main`, `npm audit` clean, backup taken *(backend)*, then deploy and click
through: book a service, open the visit, open the salon side.
