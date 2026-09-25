import { describe, expect, it } from "vitest";
import type { Customer, Service, Visit } from "../data/types";
import { amountDue, checkCode, cleanContact, findVisit, normalizeVisitNumber, paymentKindFor, paystackReference, samePhone, upsertCustomer, validateContact, type PendingCode } from "./checkout";
import { formatGhPhone, normalizeGhPhone, whatsappLink } from "./contact";
import { money, parseLocal, relativeDay } from "./format";
import { amountInWords, receiptNumber, verifyCode, visitNumber } from "./receipts";
import { cartTotal, commissionFor, depositFor, durationLabel } from "./pricing";
import { badgeFor, balanceDue, canCancel, isLateCancel, nextStep, paidTotal, validatePayment, whenPhrase } from "./visits";

const service = (id: string, price: number, minutes: number): Service => ({
  id, name: id, group: "hair", description: "", price, minutes, bookable: true, repeatWeeks: 0, tone: "magenta",
});

function visit(partial: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    number: "RH-1000",
    customerId: "c1",
    branchId: "b1",
    staffId: "st1",
    items: [],
    start: "2026-01-05T10:00",
    minutes: 60,
    createdAt: "2026-01-01T00:00",
    status: "confirmed",
    history: [],
    source: "online",
    total: 300,
    payments: [],
    ...partial,
  };
}

const payment = (amount: number) => ({ id: "p1", amount, method: "momo" as const, reference: "r", at: "2026-01-05T10:00:00.000Z", receiptNo: "RHR-2026-0001", kind: "deposit" as const, receivedBy: "Paystack (online)" });

describe("money and duration", () => {
  it("formats cedis the Ghanaian way", () => {
    expect(money(1500)).toBe("GH₵ 1,500");
    expect(money(12.5)).toBe("GH₵ 12.50");
    expect(money(-80)).toBe("-GH₵ 80");
  });

  it("reads durations the way a receptionist says them", () => {
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(150)).toBe("2 hr 30 min");
  });
});

describe("Ghana phone numbers", () => {
  it("normalises every local format to one key", () => {
    expect(normalizeGhPhone("024 613 6708")).toBe("233246136708");
    expect(normalizeGhPhone("+233 24 613 6708")).toBe("233246136708");
    expect(normalizeGhPhone("0246136708")).toBe("233246136708");
  });

  it("rejects what isn't a Ghana number", () => {
    expect(normalizeGhPhone("12345")).toBeNull();
    expect(normalizeGhPhone("+44 7700 900000")).toBeNull();
  });

  it("matches the same person written two ways", () => {
    expect(samePhone("024 613 6708", "+233246136708")).toBe(true);
    expect(samePhone("024 613 6708", "024 613 6709")).toBe(false);
  });

  it("formats for display and builds a WhatsApp link", () => {
    expect(formatGhPhone("+233246136708")).toBe("024 613 6708");
    expect(whatsappLink("024 613 6708", "Hi")).toBe("https://wa.me/233246136708?text=Hi");
  });
});

describe("pricing", () => {
  it("adds a basket up", () => {
    expect(cartTotal([service("a", 450, 240), service("b", 120, 60)])).toBe(570);
  });

  it("rounds the deposit up to the next cedi and never exceeds the bill", () => {
    expect(depositFor(450, 0.3)).toBe(135);
    expect(depositFor(35, 0.3)).toBe(11);
    expect(depositFor(10, 1.5)).toBe(10);
    expect(depositFor(0)).toBe(0);
  });

  it("works out commission", () => {
    expect(commissionFor(450, 0.35)).toBe(157.5);
  });
});

describe("visit money", () => {
  it("adds payments and leaves the right balance", () => {
    const v = visit({ payments: [payment(100), payment(50)] });
    expect(paidTotal(v)).toBe(150);
    expect(balanceDue(v)).toBe(150);
  });

  it("never shows a negative balance", () => {
    expect(balanceDue(visit({ total: 100, payments: [payment(150)] }))).toBe(0);
  });

  it("refuses a payment bigger than the balance", () => {
    expect(validatePayment(visit({ payments: [payment(250)] }), 100)).toMatch(/more than the/);
  });

  it("refuses payments on a cancelled visit and zero amounts", () => {
    expect(validatePayment(visit({ status: "cancelled" }), 50)).toMatch(/cancelled/);
    expect(validatePayment(visit(), 0)).toMatch(/above zero/);
  });

  it("charges the deposit first and the balance afterwards", () => {
    expect(amountDue(visit({ status: "requested" }))).toEqual({ amount: 90, label: "deposit" });
    expect(amountDue(visit({ payments: [payment(90)] }))).toEqual({ amount: 210, label: "balance" });
  });

  it("labels the last payment as final", () => {
    expect(paymentKindFor(visit({ payments: [payment(90)] }), 210)).toBe("final");
    expect(paymentKindFor(visit(), 90)).toBe("deposit");
    expect(paymentKindFor(visit({ payments: [payment(90)] }), 50)).toBe("part");
  });
});

describe("visit state", () => {
  const now = parseLocal("2026-01-05T09:00");

  it("lets a client cancel only before they arrive", () => {
    expect(canCancel(visit({ status: "confirmed" }))).toBe(true);
    expect(canCancel(visit({ status: "arrived" }))).toBe(false);
  });

  it("spots a cancellation inside the notice window", () => {
    expect(isLateCancel(visit({ start: "2026-01-05T10:00" }), now, 24)).toBe(true);
    expect(isLateCancel(visit({ start: "2026-01-09T10:00" }), now, 24)).toBe(false);
  });

  it("badges a visit the desk should chase", () => {
    expect(badgeFor(visit({ status: "confirmed", start: "2026-01-05T08:00" }), now).label).toBe("Running late");
    expect(badgeFor(visit({ status: "done", payments: [payment(300)] }), now).label).toBe("Done");
    expect(badgeFor(visit({ status: "done" }), now).label).toBe("Balance due");
    expect(badgeFor(visit({ status: "no-show" }), now).tone).toBe("danger");
  });

  it("says when a visit is in plain words", () => {
    expect(whenPhrase(visit({ start: "2026-01-05T14:30" }), now)).toBe("today at 14:30");
    expect(whenPhrase(visit({ start: "2026-01-06T09:00" }), now)).toBe("tomorrow at 09:00");
  });

  it("reads nearby days as words", () => {
    expect(relativeDay(parseLocal("2026-01-04T10:00"), now)).toBe("Yesterday");
  });

  it("gives the desk one next step for each stage of the day", () => {
    expect(nextStep(visit({ status: "requested" }))).toMatchObject({ kind: "move", to: "confirmed" });
    expect(nextStep(visit({ status: "confirmed" }))).toMatchObject({ kind: "move", to: "arrived" });
    expect(nextStep(visit({ status: "arrived" }))).toMatchObject({ kind: "move", to: "in-chair" });
    expect(nextStep(visit({ status: "cancelled" }))).toBeNull();
    expect(nextStep(visit({ status: "no-show" }))).toBeNull();
  });

  it("takes the money before finishing, and only what is still owed", () => {
    expect(nextStep(visit({ status: "in-chair", payments: [payment(100)] }))).toEqual({ kind: "pay", label: `Take ${money(200)} and finish` });
    expect(nextStep(visit({ status: "in-chair", payments: [payment(300)] }))).toMatchObject({ kind: "move", to: "done" });
    expect(nextStep(visit({ status: "done" }))).toEqual({ kind: "pay", label: `Take ${money(300)}` });
    expect(nextStep(visit({ status: "done", payments: [payment(300)] }))).toBeNull();
  });
});

describe("contact details", () => {
  it("asks for what Paystack and WhatsApp need", () => {
    const errors = validateContact({ name: "A", phone: "12345", email: "nope", area: "" });
    expect(Object.keys(errors).sort()).toEqual(["area", "email", "name", "phone"]);
  });

  it("accepts a complete set", () => {
    expect(validateContact({ name: "Naa Adjeley", phone: "024 501 2233", email: "naa@gmail.com", area: "Weija" })).toEqual({});
  });

  it("tidies what was typed", () => {
    expect(cleanContact({ name: "  naa   adjeley ", phone: "+233246136708", email: " NAA@Gmail.com ", area: " Weija " })).toEqual({
      name: "naa adjeley",
      phone: "024 613 6708",
      email: "naa@gmail.com",
      area: "Weija",
    });
  });
});

describe("upsertCustomer", () => {
  const existing: Customer = { id: "c1", name: "Naa", phone: "024 501 2233", email: "naa@gmail.com", area: "Weija", memberSince: "2025-01-01", hasAccount: true, points: 240, hair: { notes: "Fine edges" } };
  const contact = { name: "Naa Adjeley", phone: "+233 24 501 2233", email: "naa@gmail.com", area: "Dansoman" };

  it("updates the one record when the same number books again", () => {
    const { customers, customer } = upsertCustomer([existing], contact, { now: new Date(), newId: () => "c2" });
    expect(customers).toHaveLength(1);
    expect(customer.area).toBe("Dansoman");
  });

  it("keeps the account, points and hair record", () => {
    const { customer } = upsertCustomer([existing], contact, { now: new Date(), newId: () => "c2" });
    expect(customer.hasAccount).toBe(true);
    expect(customer.points).toBe(240);
    expect(customer.hair?.notes).toBe("Fine edges");
  });

  it("creates a guest when the number is new", () => {
    const { customers, customer } = upsertCustomer([existing], { ...contact, phone: "020 111 2222" }, { now: new Date(), newId: () => "c2" });
    expect(customers).toHaveLength(2);
    expect(customer.hasAccount).toBe(false);
  });
});

describe("finding a booking", () => {
  const customers: Customer[] = [{ id: "c1", name: "Naa", phone: "024 501 2233", email: "", area: "", memberSince: "2025-01-01", hasAccount: false, points: 0 }];
  const visits = [visit({ number: "RH-1000" })];

  it("accepts the number however it is typed", () => {
    expect(normalizeVisitNumber("rh1000")).toBe("RH-1000");
    expect(normalizeVisitNumber("RH-1000")).toBe("RH-1000");
    expect(normalizeVisitNumber("1000")).toBe("RH-1000");
    expect(normalizeVisitNumber("nonsense")).toBeNull();
  });

  it("needs the booking number and the WhatsApp number to agree", () => {
    expect(findVisit(visits, customers, "1000", "024 501 2233")?.id).toBe("v1");
    expect(findVisit(visits, customers, "1000", "024 999 8888")).toBeNull();
  });
});

describe("one-time codes", () => {
  const pending = (over: Partial<PendingCode> = {}): PendingCode => ({ phone: "024 501 2233", code: "123456", expiresAt: 1_000, attempts: 0, ...over });

  it("accepts the right code once", () => {
    const { result, pending: left } = checkCode(pending(), "024 501 2233", "123456", 0);
    expect(result).toBe("ok");
    expect(left).toBeNull();
  });

  it("counts wrong tries and locks after five", () => {
    const { result } = checkCode(pending({ attempts: 4 }), "024 501 2233", "000000", 0);
    expect(result).toBe("locked");
  });

  it("expires", () => {
    expect(checkCode(pending(), "024 501 2233", "123456", 2_000).result).toBe("expired");
  });

  it("won't accept a code sent to a different number", () => {
    expect(checkCode(pending(), "020 111 2222", "123456", 0).result).toBe("missing");
  });
});

describe("references and receipts", () => {
  it("builds a Paystack reference that is unique per attempt", () => {
    expect(paystackReference("RH-1042", "7k2m9q")).toBe("RH1042-7K2M9Q");
    expect(paystackReference("RH-1042", "ab")).toBe("RH1042-AB0000");
  });

  it("numbers bookings and receipts in sequence", () => {
    expect(visitNumber(1042)).toBe("RH-1042");
    expect(receiptNumber(2026, 7)).toBe("RHR-2026-0007");
  });

  it("writes the amount in words for the receipt", () => {
    expect(amountInWords(450)).toBe("Four hundred and fifty Ghana cedis only");
    expect(amountInWords(1)).toBe("One Ghana cedi only");
  });

  it("gives a stable check code per receipt", () => {
    expect(verifyCode("RHR-2026-0007", 450)).toBe(verifyCode("RHR-2026-0007", 450));
    expect(verifyCode("RHR-2026-0007", 450)).not.toBe(verifyCode("RHR-2026-0007", 451));
  });
});
