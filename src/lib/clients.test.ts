import { describe, expect, it } from "vitest";
import type { Customer, Visit } from "../data/types";
import { clientFiltersToParams, clientRows, DEFAULT_CLIENT_FILTERS, filterClients, parseClientFilters } from "./clients";
import { parseLocal } from "./format";

const NOW = parseLocal("2026-03-15T12:00");

const customer = (id: string, name: string, extra: Partial<Customer> = {}): Customer => ({
  id, name, phone: "024 501 2233", email: "", area: "Weija", memberSince: "2025-01-01", hasAccount: false, points: 0, source: "instagram", ...extra,
});

function visit(partial: Partial<Visit> & Pick<Visit, "id" | "customerId" | "start">): Visit {
  return {
    number: "RH-1000", branchId: "b1", staffId: "st1", items: [{ id: "i", serviceId: "s-cut", price: 60, minutes: 30 }], minutes: 30,
    createdAt: "2026-01-01T00:00", status: "done", history: [], source: "online", total: 60, payments: [], ...partial,
  };
}

const paid = (amount: number) => [{ id: "p", amount, method: "cash" as const, reference: "Cash", at: "2026-03-01T10:00:00.000Z", receiptNo: "RHR-2026-0001", kind: "final" as const, receivedBy: "Front desk" }];

const customers = [customer("c1", "Naa Adjeley"), customer("c2", "Kojo Baah", { phone: "020 111 2222", area: "Kasoa", source: "walkin" }), customer("c3", "Esi Mensah", { phone: "055 333 4444" })];
const visits = [
  visit({ id: "a", customerId: "c1", start: "2026-03-10T10:00", payments: paid(60) }),
  visit({ id: "b", customerId: "c2", start: "2026-03-14T10:00", status: "done" }),
  visit({ id: "c", customerId: "c3", start: "2026-03-20T10:00", status: "confirmed" }),
  // Naa's relaxer from ten weeks ago makes her due back now.
  visit({ id: "d", customerId: "c1", start: "2026-01-04T10:00", rebookDue: "2026-03-15", payments: paid(220) }),
];

describe("client rows", () => {
  const rows = clientRows(customers, visits, NOW);
  const row = (id: string) => rows.find((r) => r.customer.id === id)!;

  it("adds up spend and knows the last finished visit", () => {
    expect(row("c1")).toMatchObject({ visits: 2, spend: 280, lastVisitAt: "2026-03-10T10:00" });
  });

  it("counts an unpaid finished visit as owed", () => {
    expect(row("c2").owed).toBe(60);
    expect(row("c1").owed).toBe(0);
  });

  it("counts upcoming visits", () => {
    expect(row("c3").upcoming).toBe(1);
  });
});

describe("filtering and sorting", () => {
  const rows = clientRows(customers, visits, NOW);

  it("finds a client by name, area or phone however it is typed", () => {
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, q: "kojo" }).map((r) => r.customer.id)).toEqual(["c2"]);
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, q: "kasoa" }).map((r) => r.customer.id)).toEqual(["c2"]);
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, q: "+233 55 333 4444" }).map((r) => r.customer.id)).toEqual(["c3"]);
  });

  it("filters to who owes, who is coming, and who found the salon on Instagram", () => {
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, owes: true }).map((r) => r.customer.id)).toEqual(["c2"]);
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, upcoming: true }).map((r) => r.customer.id)).toEqual(["c3"]);
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, sources: ["walkin"] }).map((r) => r.customer.id)).toEqual(["c2"]);
  });

  it("sorts by most spent", () => {
    expect(filterClients(rows, { ...DEFAULT_CLIENT_FILTERS, sort: "spend" })[0]?.customer.id).toBe("c1");
  });
});

describe("filters in the address bar", () => {
  it("round-trips every filter", () => {
    const f = { ...DEFAULT_CLIENT_FILTERS, q: "naa", sort: "spend" as const, owes: true, dueBack: true, sources: ["tiktok" as const], areas: ["Weija"] };
    expect(parseClientFilters(clientFiltersToParams(f))).toEqual(f);
  });

  it("reads the old view=rebook link as the due-back filter", () => {
    expect(parseClientFilters(new URLSearchParams("view=rebook")).dueBack).toBe(true);
  });

  it("ignores junk", () => {
    expect(parseClientFilters(new URLSearchParams("sort=weird&source=myspace"))).toMatchObject({ sort: "recent", sources: [] });
  });
});
