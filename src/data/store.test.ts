import { beforeEach, describe, expect, it } from "vitest";
import { visibleVisits } from "../lib/checkout";
import { dayKey, localIso, parseLocal, startOfDay } from "../lib/format";
import { accessOf, accountOf, actions, desk, getAppData, type BookingDraft, type WalkInDraft } from "./store";

/**
 * A Wednesday at least a week away: West Hills Mall is open, Adwoa works, and it is
 * clear of everything the seed books in the next six days.
 */
function futureWednesday(): Date {
  const date = startOfDay(new Date());
  date.setDate(date.getDate() + 7);
  while (date.getDay() !== 3) date.setDate(date.getDate() + 1);
  return date;
}

const DAY = dayKey(futureWednesday());
const NOW = startOfDay(new Date());

const draft = (overrides: Partial<BookingDraft> = {}): BookingDraft => ({
  branchId: "b-westhills",
  staffId: "st-adwoa",
  serviceIds: ["s-perm"],
  start: `${DAY}T11:00`,
  contact: { name: "Ama Mensah", phone: "024 851 5773", email: "ama@gmail.com", area: "Kasoa" },
  remember: true,
  ...overrides,
});

const walkIn = (overrides: Partial<WalkInDraft> = {}): WalkInDraft => ({
  branchId: "b-westhills",
  staffId: "st-kwabena",
  serviceIds: ["s-cut"],
  start: `${DAY}T12:00`,
  source: "walkin",
  newClient: { name: "Kojo Baah", phone: "020 444 5566", source: "walkin" },
  ...overrides,
});

const unwrap = <T,>(result: T | { error: string }): T => {
  if (result && typeof result === "object" && "error" in result) throw new Error((result as { error: string }).error);
  return result as T;
};

describe("booking as a guest", () => {
  beforeEach(() => actions.resetDemo());

  it("starts signed out with nothing on this phone", () => {
    const data = getAppData();
    expect(accountOf(data)).toBeNull();
    expect(visibleVisits(data.visits, accessOf(data))).toEqual([]);
  });

  it("books without an account and keeps the visit on this phone", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    const data = getAppData();
    const guest = data.customers.find((c) => c.id === visit.customerId);

    expect(guest).toMatchObject({ name: "Ama Mensah", hasAccount: false });
    expect(visit).toMatchObject({ status: "requested", source: "online", payments: [] });
    expect(visit.total).toBe(220);
    expect(visit.minutes).toBe(120);
    expect(data.device.visitIds).toEqual([visit.id]);
    expect(data.device.contact?.email).toBe("ama@gmail.com");
    expect(data.device.branchId).toBe("b-westhills");
  });

  it("forgets the typed details when the box is unticked", () => {
    unwrap(actions.book(draft({ remember: false }), NOW));
    expect(getAppData().device.contact).toBeNull();
  });

  it("takes no money online: the booking waits for the salon to confirm, with the full bill to pay there", () => {
    const receiptsBefore = getAppData().counters.receipt;
    const { visit } = unwrap(actions.book(draft(), NOW));
    expect(visit).toMatchObject({ status: "requested", payments: [] });
    expect(visit.total).toBeGreaterThan(0);
    expect(getAppData().counters.receipt).toBe(receiptsBefore);
  });

  it("confirms a booking when the desk takes money for it", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    const { payment } = unwrap(desk.recordPayment(visit.id, { amount: 50, method: "momo", reference: "MP123" }, NOW));
    expect(payment).toMatchObject({ receivedBy: "Front desk", method: "momo" });
    expect(payment.receiptNo).toMatch(/^RHR-\d{4}-\d{4}$/);
    expect(getAppData().visits.find((v) => v.id === visit.id)?.status).toBe("confirmed");
  });

  it("sets the rebook date from the longest repeat on the visit", () => {
    const { visit } = unwrap(actions.book(draft({ serviceIds: ["s-perm", "s-washset"] }), NOW));
    const due = new Date(futureWednesday());
    due.setDate(due.getDate() + 70); // the perm's ten weeks, not the wash's two
    expect(visit.rebookDue).toBe(dayKey(due));
  });

  it("keeps one client record when the same number books twice", () => {
    const first = unwrap(actions.book(draft(), NOW));
    const second = unwrap(actions.book(draft({ start: `${DAY}T14:00`, contact: { ...draft().contact, area: "Weija" } }), NOW));
    expect(second.visit.customerId).toBe(first.visit.customerId);
    expect(getAppData().customers.filter((c) => c.name === "Ama Mensah")).toHaveLength(1);
  });

  it("refuses an empty basket", () => {
    expect(actions.book(draft({ serviceIds: [] }), NOW)).toEqual({ error: "Choose at least one service." });
  });
});

describe("double booking", () => {
  beforeEach(() => actions.resetDemo());

  it("refuses a second booking that overlaps the same stylist", () => {
    unwrap(actions.book(draft(), NOW));
    const clash = actions.book(draft({ start: `${DAY}T12:00`, contact: { ...draft().contact, phone: "020 111 2222" } }), NOW);
    expect(clash).toEqual({ error: expect.stringMatching(/just booked/) });
    expect(getAppData().visits.filter((v) => v.start.startsWith(DAY))).toHaveLength(1);
  });

  it("allows the same time with a different member of staff", () => {
    unwrap(actions.book(draft(), NOW));
    const other = actions.book(draft({ staffId: "st-efua", contact: { ...draft().contact, phone: "020 111 2222" } }), NOW);
    expect("error" in other).toBe(false);
  });

  it("frees the slot again once a visit is cancelled", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    actions.cancel(visit.id, NOW);
    expect("error" in actions.book(draft({ contact: { ...draft().contact, phone: "020 111 2222" } }), NOW)).toBe(false);
  });

  it("refuses a walk-in that lands on top of an online booking", () => {
    unwrap(actions.book(draft(), NOW));
    expect(desk.create(walkIn({ staffId: "st-adwoa", start: `${DAY}T11:30` }), NOW)).toEqual({ error: expect.stringMatching(/just booked/) });
  });

  it("refuses a booking with a stylist from another branch", () => {
    expect(actions.book(draft({ branchId: "b-kumasi" }), NOW)).toEqual({ error: expect.stringMatching(/doesn't work at/) });
  });

  it("refuses a time outside the branch's opening hours", () => {
    expect(actions.book(draft({ start: `${DAY}T23:00` }), NOW)).toEqual({ error: expect.stringMatching(/opening hours/) });
  });
});

describe("rescheduling", () => {
  beforeEach(() => actions.resetDemo());

  it("moves a visit without clashing with itself", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    const moved = unwrap(actions.reschedule(visit.id, `${DAY}T11:30`, NOW));
    expect(moved.visit.start).toBe(`${DAY}T11:30`);
  });

  it("refuses to move onto someone else's slot", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    unwrap(actions.book(draft({ start: `${DAY}T15:00`, contact: { ...draft().contact, phone: "020 111 2222" } }), NOW));
    expect(actions.reschedule(visit.id, `${DAY}T15:30`, NOW)).toEqual({ error: expect.stringMatching(/just booked/) });
  });

  it("leaves the clean-down gap after a visit before the next online booking", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    const gap = getAppData().settings.policies.turnaroundMinutes;
    const end = new Date(parseLocal(visit.start).getTime() + visit.minutes * 60_000);
    const other = { ...draft().contact, phone: "020 111 2222" };
    expect(actions.book(draft({ serviceIds: ["s-cut"], start: localIso(end), contact: other }), NOW)).toEqual({ error: expect.stringMatching(/between clients to clean down/) });
    const later = new Date(end.getTime() + gap * 60_000);
    expect("error" in actions.book(draft({ serviceIds: ["s-cut"], start: localIso(later), contact: other }), NOW)).toBe(false);
  });

  it("lets the desk seat someone the moment the chair is free", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    const end = new Date(parseLocal(visit.start).getTime() + visit.minutes * 60_000);
    expect("error" in desk.create(walkIn({ staffId: "st-adwoa", start: localIso(end) }), NOW)).toBe(false);
  });

  it("won't let a client move a visit once they have arrived", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    unwrap(desk.moveTo(visit.id, "arrived", NOW));
    expect(actions.reschedule(visit.id, `${DAY}T13:00`, NOW)).toEqual({ error: expect.stringMatching(/no longer be moved/) });
  });
});

describe("the desk", () => {
  beforeEach(() => actions.resetDemo());

  it("seats a walk-in straight away and creates the client", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    expect(visit).toMatchObject({ status: "arrived", source: "walkin" });
    expect(getAppData().customers.find((c) => c.id === visit.customerId)?.name).toBe("Kojo Baah");
  });

  it("reuses the client record when a walk-in number is already known", () => {
    const before = getAppData().customers.length;
    const { visit } = unwrap(desk.create(walkIn({ newClient: { name: "Naa A", phone: "024 501 2233", source: "walkin" } }), NOW));
    expect(visit.customerId).toBe("c-naa");
    expect(getAppData().customers).toHaveLength(before);
  });

  it("needs a real Ghana number for a new walk-in", () => {
    expect(desk.create(walkIn({ newClient: { name: "Kojo", phone: "123", source: "walkin" } }), NOW)).toEqual({ error: expect.stringMatching(/Ghana phone number/) });
  });

  it("won't finish a visit with money still owing, unless told to", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    expect(desk.moveTo(visit.id, "done", NOW)).toEqual({ error: expect.stringMatching(/balance to settle/) });
    expect("error" in desk.moveTo(visit.id, "done", NOW, { allowOwing: true })).toBe(false);
  });

  it("finishes cleanly once the bill is settled", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    unwrap(desk.recordPayment(visit.id, { amount: 60, method: "cash" }, NOW));
    const done = unwrap(desk.moveTo(visit.id, "done", NOW));
    expect(done.visit.status).toBe("done");
  });

  it("refuses to take more money than is owed", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    expect(desk.recordPayment(visit.id, { amount: 500, method: "cash" }, NOW)).toEqual({ error: expect.stringMatching(/more than the/) });
  });

  it("adds a service in the chair and re-checks the slot", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    const next = unwrap(desk.setServices(visit.id, ["s-cut", "s-beard"], NOW));
    expect(next.visit.total).toBe(105);
    expect(next.visit.minutes).toBe(60);
  });

  it("won't cut the bill below what has already been paid", () => {
    const { visit } = unwrap(desk.create(walkIn({ serviceIds: ["s-cut", "s-beard"] }), NOW));
    unwrap(desk.recordPayment(visit.id, { amount: 105, method: "cash" }, NOW));
    expect(desk.setServices(visit.id, ["s-shapeup"], NOW)).toEqual({ error: expect.stringMatching(/less than what's already paid/) });
  });

  it("moves a visit to another branch and stylist", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    const moved = unwrap(desk.move(visit.id, { branchId: "b-kumasi", staffId: "st-ama" }, NOW));
    expect(moved.visit).toMatchObject({ branchId: "b-kumasi", staffId: "st-ama" });
  });

  it("won't cancel a visit that is already finished", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    unwrap(desk.recordPayment(visit.id, { amount: 60, method: "cash" }, NOW));
    unwrap(desk.moveTo(visit.id, "done", NOW));
    expect(desk.moveTo(visit.id, "cancelled", NOW)).toEqual({ error: expect.stringMatching(/already closed/) });
  });

  it("keeps a no-show on the record and releases the slot", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    unwrap(desk.moveTo(visit.id, "no-show", NOW));
    expect(getAppData().visits.find((v) => v.id === visit.id)?.status).toBe("no-show");
    expect("error" in actions.book(draft({ contact: { ...draft().contact, phone: "020 111 2222" } }), NOW)).toBe(false);
  });
});

describe("the hair record", () => {
  beforeEach(() => actions.resetDemo());

  it("saves what the stylist needs to remember", () => {
    unwrap(desk.saveHairRecord("c-yaa", { allergies: " Ammonia ", colourFormula: "6N + 20 vol", notes: "" }));
    const saved = getAppData().customers.find((c) => c.id === "c-yaa")?.hair;
    expect(saved).toMatchObject({ allergies: "Ammonia", colourFormula: "6N + 20 vol" });
    expect(saved?.notes).toBeUndefined();
  });

  it("refuses an unknown client", () => {
    expect(desk.saveHairRecord("nobody", {})).toEqual({ error: "We couldn't find that client." });
  });
});

describe("prices, staff and branches", () => {
  beforeEach(() => actions.resetDemo());

  it("saves a new price and rejects a silly one", () => {
    expect(unwrap(desk.saveService("s-cut", { price: 70 })).service.price).toBe(70);
    expect(desk.saveService("s-cut", { price: -5 })).toEqual({ error: expect.stringMatching(/Prices must be/) });
    expect(desk.saveService("s-cut", { minutes: 2 })).toEqual({ error: expect.stringMatching(/between 5 and 600/) });
  });

  it("keeps history at the price it was booked at", () => {
    const { visit } = unwrap(desk.create(walkIn(), NOW));
    unwrap(desk.saveService("s-cut", { price: 999 }));
    expect(getAppData().visits.find((v) => v.id === visit.id)?.items[0]?.price).toBe(60);
  });

  it("won't put a staff member at a branch that doesn't exist", () => {
    expect(desk.saveStaff("st-adwoa", { branchId: "nowhere" })).toEqual({ error: "We couldn't find that branch." });
  });

  it("checks branch opening hours close after they open", () => {
    const hours = [...getAppData().branches[0]!.hours];
    hours[1] = ["18:00", "09:00"];
    expect(desk.saveBranch("b-westhills", { hours })).toEqual({ error: expect.stringMatching(/close after it opens/) });
  });

  it("validates the salon's own details", () => {
    expect(desk.saveSettings({ salon: { phone: "123" } })).toEqual({ error: expect.stringMatching(/Ghana phone number/) });
    expect(desk.saveSettings({ policies: { turnaroundMinutes: 90 } })).toEqual({ error: expect.stringMatching(/between 0 and 60 minutes/) });
    expect("error" in desk.saveSettings({ policies: { turnaroundMinutes: 15 } })).toBe(false);
  });
});

describe("accounts", () => {
  beforeEach(() => actions.resetDemo());

  it("signs in an existing account by WhatsApp number", () => {
    expect(actions.logIn("024 501 2233")?.id).toBe("c-naa");
    expect(accountOf(getAppData())?.name).toBe("Naa Adjeley");
  });

  it("returns null for a number with no account", () => {
    expect(actions.logIn("020 999 0000")).toBeNull();
  });

  it("turns a guest record into an account without losing history", () => {
    const account = actions.createAccount({ name: "Selorm Agbo", phone: "055 220 8899" });
    expect(account.id).toBe("c-selorm");
    expect(account.hasAccount).toBe(true);
    expect(account.points).toBe(60);
  });

  it("hides account visits again after signing out", () => {
    actions.logIn("024 501 2233");
    expect(visibleVisits(getAppData().visits, accessOf(getAppData())).length).toBeGreaterThan(0);
    actions.logOut();
    expect(visibleVisits(getAppData().visits, accessOf(getAppData()))).toEqual([]);
  });

  it("finds a booking with its number and WhatsApp number", () => {
    const { visit } = unwrap(actions.book(draft(), NOW));
    expect(actions.lookUpVisit(visit.number, "024 851 5773")?.id).toBe(visit.id);
    expect(actions.lookUpVisit(visit.number, "020 000 0000")).toBeNull();
  });
});

describe("allergies given at booking", () => {
  beforeEach(() => actions.resetDemo());

  it("lands on the hair record so the stylist sees it", () => {
    const { visit } = unwrap(actions.book(draft({ serviceIds: ["s-colour"], allergies: "Reacts to PPD" }), NOW));
    const hair = getAppData().customers.find((c) => c.id === visit.customerId)?.hair;
    expect(hair?.allergies).toBe("Client says: Reacts to PPD");
  });

  it("adds to an allergy already on file instead of replacing it", () => {
    unwrap(actions.book(draft({ contact: { ...draft().contact, phone: "024 501 2233" }, allergies: "Latex" }), NOW));
    const hair = getAppData().customers.find((c) => c.id === "c-naa")?.hair;
    expect(hair?.allergies).toMatch(/^Reacts to ammonia-based colour.*Client says: Latex$/);
  });

  it("ignores a blank answer", () => {
    const { visit } = unwrap(actions.book(draft({ allergies: "   " }), NOW));
    expect(getAppData().customers.find((c) => c.id === visit.customerId)?.hair).toBeUndefined();
  });
});
