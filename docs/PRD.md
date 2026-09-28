# Royal Hair Salon & Spa: Barbershop & Salon App (Demo) PRD

## Goal
Royal Hair is a barbershop and a salon under one roof. Give clients one place to see the real prices, pick a stylist and book a chair, and give the
owner one screen per branch that shows the whole day. One app with two sides, sharing the same data.

## Who
- **Clients:** women booking braids, weaves, perms, colour and treatments; men booking cuts and
  beard work; parents booking kids' cuts; and spa clients booking massage, manicure and pedicure.
  They arrive from Instagram (5,663 followers) and TikTok on a phone, or walk into the mall.
- **Owner and branch managers:** they work from a phone at the front desk, sometimes a laptop in
  the office. Three branches run at once and staff change often.

## Stage
Clickable demo using sample data stored in the browser. WhatsApp codes and logins are simulated:
no messages are sent. Nothing is paid online at all: every visit is paid at the salon desk
(see `docs/decisions/0001-pay-at-the-salon.md`).

## Design
The house layout system (the tailor and bakery apps) in Royal Hair colours: near-black ink and
white cards on a neutral light grey page, with the brand's pink as the one bright accent.

## The business, as found (Sept 2026)
Facts confirmed from their own channels and public listings. Anything not confirmed is marked.

| Fact | Value | Source |
|---|---|---|
| Branches | West Hills Mall (Weija), Airport (14 Casely Hayford Rd), Kumasi | Directory listings, IG |
| Central WhatsApp | 024 613 6708 | TikTok and Instagram bio |
| Central landline | 030 290 9560 | TikTok and Instagram bio |
| West Hills Mall branch | 030 396 5412 | TikTok bio |
| Royal Spa line | 030 396 5413 | TikTok bio |
| Airport branch | 050 025 2019 | TortoisePath listing |
| Instagram | @royalhair_gh, 5,663 followers, still posting (19 and 13 Sept 2026: hiring flyers) | Instagram |
| TikTok | @royalhairgh, 212 followers, 19 posts, last post 1 Jan 2026 | TikTok |
| Website | none | No link in any bio |
| Online booking | none live (a Wavier listing exists but 404s) | Wavier |
| Published price list | none | Every directory says so explicitly |
| Published opening hours | none (Facebook says "Always open", which is wrong) | Facebook |
| Services | women's hair, men's barbering, kids' cuts, nails, pedicure, spa/massage | Their own TikTok captions |
| Hiring | salon supervisor, lash tech, nail tech (Sept 2026); barbers at West Hills Mall (Mar 2026); a professional barber at Airport (May 2025) | Instagram posts |
| Barbershop | a barber pole on the wall and barbers on staff at West Hills and Airport | TikTok video, Instagram hiring posts |
| Logo | pink glossy crown over "ROYAL_HAIR", sent by the salon | `brand/logo-original.png` |
| Photos | stills from their own TikTok posts | `docs/photo-sources.md` |

**To confirm with the owner before go-live:** the real price for every service, real opening hours
per branch, chairs and staff per branch, the walk-in vs appointment split, who owns the domain, whether any branch already runs a POS, each branch's own
phone number (Kumasi has none published), and written permission to use their TikTok stills on the
site. Prices in `src/data/catalog.ts` are placeholders, checked against the market: a Kumasi
barbershop-salon on Fresha (Sept 2026) charges GH₵60 for a 30-minute adult cut, GH₵40 for a
15-minute shape-up and GH₵50 for kids' hair.

## Client side
| Screen | Job |
|---|---|
| Home | Brand, the three branches, what they do, today's availability, starting prices, reviews, hours, WhatsApp |
| Services | The price list they have never published. Filter by Hair, Barbering, Nails, Spa, Kids. Price and how long it takes, on every line. |
| Book | Services → branch and stylist (or first available) → day and time → your details → review and book. Nothing to pay online, no account needed, email optional. |
| Pay | At the salon only: cash, MoMo or card at the desk after the visit. The official receipt then appears in My visits. |
| My visits | Visits booked on this phone; "Find my booking" with booking number + WhatsApp number + code |
| Visit detail | When, where, who with, what it costs, directions, reschedule, cancel, add to calendar |
| Account (optional) | WhatsApp number + code, no password. Visits, hair record, points and receipts on any phone |

## Owner side
| Screen | Job |
|---|---|
| Today | One branch at a time: who is in the chair now, who is next, arrivals not yet seated, no-shows, chairs free this afternoon, cash so far today |
| Diary | Day view, one column per staff member. Drag-free: tap an empty slot to add a walk-in, tap a visit to work on it. |
| Walk-in | Two taps: service and staff. The commonest way a Ghanaian salon takes work. |
| Visits | List by day and status, reschedule, mark arrived, in the chair, done, no-show |
| Receipts | Numbered official receipt per payment (print or share) |
| Clients | History, spend, last visit, the hair record (relaxer dates, colour formula, allergies, preferred stylist), and rebook-due list |
| Staff | Who works where, which services they do, their day, and commission earned |
| Services & prices | Edit prices, durations and what is bookable online |
| Reports | Revenue and chair use by branch, top services, quiet hours, no-show rate |
| Settings | Branch details, MoMo number, receipt footer, reset demo |

## Data model
- **Branch:** name, area, address, phone, GhanaPost address, opening hours per weekday, chairs
- **Service:** name, group (hair / barbering / nails / spa / kids), price, minutes, bookable online,
  how many weeks until it should be repeated (drives the rebook list), active
- **Staff:** name, branch, role, the service groups they cover, working days, commission rate, active
- **Customer:** name, phone (WhatsApp, the matching key), email, area, account flag, points, lead
  source, WhatsApp consent, and the **hair record** (see below)
- **HairRecord:** allergies and sensitivities, scalp and hair notes, colour formula, last relaxer
  date, preferred stylist, preferred branch. Never shown to the client.
- **Visit:** number, customer, branch, staff, services booked, start, minutes, status history,
  price, payments, source (online / walk-in / WhatsApp / phone), notes, rebook-due date
- **Payment:** taken at the desk only. Amount, method (MoMo / card / cash / bank), reference
  (MoMo transaction ID or bank reference), receipt number, date, which staff member took it
- **This phone (no account):** remembered details (only if ticked), visits booked or found here
- **Review:** rating, text, status (pending / published / hidden), owner reply

Visit stages: `requested → confirmed → arrived → in-chair → done` (or `cancelled` / `no-show`).

## Edge cases
- **Two bookings for the same stylist at the same time must be impossible.** Every booking is
  checked against that stylist's day before it is written, and again at the moment of writing.
- A service runs longer than the slot left before closing: the slot is not offered.
- "First available" picks the stylist with the shortest day so far, not the first in the list.
- A stylist calls in sick: their day can be closed and every visit moved to another stylist.
- Walk-ins and online bookings share one diary, so a walk-in blocks the slot immediately.
- No-shows are counted against the client on their record. There is no deposit to keep.
- A client books at Kumasi but shows up at West Hills: the visit can be moved between branches.
- Branch hours differ (mall branches follow mall hours); each branch has its own week.
- Past or taken slots are never offered; a slot that fills while the client is choosing is rejected
  on submit with a clear message, not silently overwritten.
- Ghana phone formats (`024…`, `+233…`) are normalised for WhatsApp links.
- The same WhatsApp number books again as a guest: update the one customer record, don't create a second.
- A booking link opened on another phone: hidden until booking number, WhatsApp number and code match.
- Payments can exceed the price: block it.
- Cancelling inside the notice the salon asks for (24 hours by default) still works online; the
  client is asked to message the branch too, so the time can be offered to someone else.

## Payments
- Every payment is taken at the salon desk: cash, MoMo to the salon's number, card or bank.
  Staff record it against the visit, which issues the numbered official receipt.
- The site never asks for card or MoMo details, so there is no payment provider, no webhook, no
  refund flow and nothing to reconcile online. Receipt numbers must still be issued by the server
  once the real backend exists, so two desks can never hand out the same number.
- Email is optional: there are no emailed payment receipts to send.

## Out of scope (demo)
Real authentication and WhatsApp codes (need the backend), online payments of any kind (the
salon's decision), WhatsApp Business API, retail product stock, staff payroll, loyalty tiers, gift cards, and the lash and brow menu
until the new lash technician is hired.

## Decision log
| Decision | Alternatives | Why |
|---|---|---|
| Visits are the centre of the system | Separate booking, till and client systems | One entry, no retyping between the desk and the diary |
| One diary per branch, one column per staff member | A single list of bookings | A salon day is read by chair, not by time |
| Walk-in entry is two taps and always available | Online bookings only | Ghanaian salons run heavily on walk-ins; a slow walk-in flow gets abandoned on day two |
| Double-booking is prevented at write time, not just in the UI | Trust the slot list | The slot list can be stale by the time the client submits |
| Pay at the salon only (owner's decision, Sept 2026; ADR 0001) | Online deposit through Paystack | The salon wants no online payments. Booking is free and confirmed on WhatsApp; no-shows are tracked on the client record instead |
| The hair record sits on the client, not the visit | Notes per visit only | The colour formula and the allergy are why a client stays; they must survive a change of stylist |
| Rebook-due computed from the service, not a manual reminder | Manual follow-up list | "Your braids are six weeks old" writes itself from data already present |
| Prices published on the site from day one | Price on request | Four directories publicly say this business has no published rate card; it is the single biggest gap |
| Accounts optional; guest booking | Account required before booking | Clients arrive from Instagram and should book in one go |
| Customers matched by WhatsApp number | Email, or new record per booking | One history per client even without an account |
| Frontend-only demo with local data | Firebase now | Fast to show the owner; the real backend comes after they confirm prices and hours |
| Branches are data, not three deployments | One site per branch | They open branches; adding a fourth must be a row, not a rebuild |
| From a real Ghanaian barbershop on Fresha: category tabs, 15-minute slots, "from" prices, "Book again", barber shown with role, cancellation policy before confirming | Copy Fresha whole | Each one solves a barbershop problem; wallet, gift cards and memberships solve nothing Royal Hair has asked for |
| Their own site, not a Fresha page | List them on Fresha | A Fresha venue page shows "venues nearby" — competitors — under their name |
| Allergy asked only for relaxer, colour and dye, saved to the hair record | A full intake form | One question at the moment it matters; a form nobody fills in protects nobody |
| Photos are stills from their own TikTok | Stock photos | A salon site showing someone else's salon is the one thing a client notices |
