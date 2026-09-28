# 0001: Clients pay at the salon, never online

Date: 2026-09-28. Status: accepted.

## Context

The first build let clients pay a 30% deposit through Paystack (MoMo or card) when booking, or
choose to pay at the salon. Before go-live the salon decided it does not want online payments:
clients book online and pay at the desk.

## Options considered

1. **Keep the online deposit.** Cuts no-shows, but needs a Paystack account, a server to verify
   charges, webhooks, refunds for cancellations and daily reconciliation. The salon doesn't want it.
2. **Offer online payment as an option.** Still carries all of the above for a minority of clients.
3. **Pay at the salon only.** No payment provider at all.

## Decision

Option 3. Booking is free and confirmed by the branch on WhatsApp. Every payment is taken at the
desk (cash, MoMo to the salon's number, card or bank) and recorded by staff against the visit,
which issues the numbered receipt. The client sees the receipt in My visits. Email is optional.

## Consequences

- No card or MoMo details ever pass through the site: no PCI scope, no provider fees, no webhooks,
  no online refunds, nothing to reconcile.
- No deposit means nothing discourages no-shows. They are tracked on the client record, and the
  desk can ask repeat no-shows to confirm on WhatsApp. Revisit if no-shows become costly.
- The cancellation window is now a request ("please give 24 hours' notice"), not a rule with money
  attached. Clients can still cancel online at any time before they arrive.
- Receipt numbers still have to be unique across branches, so they must be issued by the backend
  when it exists, not by each browser.
- Old demo data may contain "deposit" payments; the type keeps that value so they still display.
