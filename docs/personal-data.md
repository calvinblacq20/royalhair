# Personal data inventory

Every piece of personal data the system holds, why, who can see it and when it goes. Ghana's Data
Protection Act, 2012 (Act 843) applies. Keep this in step with `src/data/types.ts` and the
privacy notice (`src/client/Legal.tsx`).

| Data | Where it lives | Why | Who sees it | Kept until |
|---|---|---|---|---|
| Client name | Customer | Confirm bookings, find history | Salon staff; the client | Deleted after the no-visit period the salon sets, or on request |
| WhatsApp number | Customer | Confirmations, reminders, matching repeat clients | Salon staff; the client | As above |
| Email (optional) | Customer | Only if the client gives it | Salon staff; the client | As above |
| Town or area | Customer | Suggest the nearest branch | Salon staff; the client | As above |
| How they found the salon | Customer | Marketing reports | Owner and managers | As above |
| Hair record: notes, colour formula, last relaxer, preferred stylist and branch | Customer | Do the client's hair consistently | Salon staff only, never shown to the client | As above |
| **Allergies and sensitivities** (health data) | Customer hair record | Client safety before chemical services | Salon staff only | As above; deleted on request at once |
| Visits: services, times, staff, notes | Visit | Run the diary | Salon staff; the client sees their own | Kept with the payment records they belong to |
| Payments: amount, method, MoMo or bank reference, receipt number | Visit | Receipts and business records | Salon staff; the client sees their own receipts | As long as Ghana's tax rules require |
| Reviews: name as given, rating, text | Review | Published on the site after approval | Public once published | Until the client or salon removes it |
| "Remember me" details, visit ids | The client's own browser (localStorage) | Refill the form, find visits without an account | Only that browser | Until cleared from Profile or the browser |
| Staff: name, branch, role, days, commission | Staff | Diary and pay | Owner and managers; clients see first name and role | While employed, then as employment law requires |

## Rules

- **Collect less.** Email is optional; allergies are asked only for relaxer, colour and dye.
- **No card or MoMo details, ever.** Payments are taken at the desk (ADR 0001).
- **Health data** (allergies) is recorded only when the client tells us and is used only for
  their safety.
- **Before launch** *(backend)*: the salon registers with the Data Protection Commission as a data
  controller; export and delete-my-data flows work; staff actions on client records are logged in
  an append-only audit log; data at rest is encrypted (Firestore does this by default: verify).
