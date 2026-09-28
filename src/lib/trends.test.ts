import { describe, expect, it } from "vitest";
import type { Customer, Visit } from "../data/types";
import { parseLocal } from "./format";
import { bookedAhead, bucketsFor, compactMoney, delta, formatPercentChange, kpi, leadSources, metricValue, paymentsByMethod, periodRange, previousRange, serviceShares, topClients } from "./trends";

const NOW = parseLocal("2026-03-15T12:00");

function visit(partial: Partial<Visit> & Pick<Visit, "id" | "start">): Visit {
  return {
    number: "RH-1000",
    customerId: "c1",
    branchId: "b1",
    staffId: "st1",
    items: [{ id: "i1", serviceId: "s-cut", price: 60, minutes: 30 }],
    minutes: 30,
    createdAt: "2026-03-01T00:00:00.000Z",
    status: "done",
    history: [],
    source: "online",
    total: 60,
    payments: [],
    ...partial,
  };
}

const payment = (amount: number, at: string) => ({ id: `p-${at}`, amount, method: "momo" as const, reference: "r", at, receiptNo: "RHR-2026-0001", kind: "final" as const, receivedBy: "Front desk" });

describe("periods", () => {
  it("covers the last 7 days up to the end of today", () => {
    const r = periodRange("7d", NOW);
    expect(r.start).toEqual(parseLocal("2026-03-09T00:00"));
    expect(r.end).toEqual(parseLocal("2026-03-16T00:00"));
  });

  it("compares with the same length just before", () => {
    const r = periodRange("30d", NOW);
    const prev = previousRange("30d", r);
    expect(prev.end).toEqual(r.start);
    expect((r.start.getTime() - prev.start.getTime()) / 86_400_000).toBe(30);
  });

  it("buckets by day, week or month", () => {
    expect(bucketsFor("7d", periodRange("7d", NOW))).toHaveLength(7);
    expect(bucketsFor("90d", periodRange("90d", NOW)).length).toBeGreaterThanOrEqual(13);
    expect(bucketsFor("year", periodRange("year", NOW))).toHaveLength(12);
  });
});

describe("metrics", () => {
  const visits = [
    visit({ id: "a", start: "2026-03-14T10:00", total: 60, payments: [payment(60, "2026-03-14T10:30:00")] }),
    visit({ id: "b", start: "2026-03-13T11:00", total: 450, customerId: "c2", payments: [payment(135, "2026-03-10T09:00:00"), payment(315, "2026-03-13T15:00:00")] }),
    visit({ id: "c", start: "2026-03-12T09:00", status: "no-show", customerId: "c3" }),
    visit({ id: "d", start: "2026-02-01T09:00", total: 120, customerId: "c1" }),
  ];
  const week = periodRange("7d", NOW);

  it("counts money on the day it arrived, part payments included", () => {
    expect(metricValue("cash", visits, week)).toBe(510);
  });

  it("counts finished visits and no-shows separately", () => {
    expect(metricValue("visits", visits, week)).toBe(2);
    expect(metricValue("noShows", visits, week)).toBe(1);
  });

  it("averages the bill of finished visits, or has nothing to say", () => {
    expect(metricValue("avgSpend", visits, week)).toBe(255);
    expect(metricValue("avgSpend", [], week)).toBeNull();
  });

  it("counts a client as new only in the period of their first visit", () => {
    // c1 first came in February, so only c2 and c3 are new this week.
    expect(metricValue("newClients", visits, week)).toBe(2);
  });

  it("builds a kpi with a series per bucket and a comparison", () => {
    const k = kpi("visits", visits, "7d", NOW);
    expect(k.value).toBe(2);
    expect(k.series).toHaveLength(7);
    expect(k.previousSeries).toHaveLength(7);
  });
});

describe("delta", () => {
  it("marks fewer no-shows as good news", () => {
    expect(delta(2, 4, "down")).toEqual({ change: -0.5, direction: "down", tone: "good" });
  });

  it("has nothing to compare against a zero or missing period", () => {
    expect(delta(5, 0, "up").change).toBeNull();
    expect(delta(null, 3, "up").tone).toBe("neutral");
  });

  it("ignores tiny wobbles", () => {
    expect(delta(1000, 1002, "up").direction).toBe("flat");
  });
});

describe("shares", () => {
  const customers: Customer[] = [
    { id: "c1", name: "A", phone: "", email: "", area: "", memberSince: "", hasAccount: false, points: 0, source: "instagram" },
    { id: "c2", name: "B", phone: "", email: "", area: "", memberSince: "", hasAccount: false, points: 0, source: "walkin" },
  ];
  const visits = [
    visit({ id: "a", start: "2026-03-14T10:00", customerId: "c1" }),
    visit({ id: "b", start: "2026-03-13T10:00", customerId: "c1" }),
    visit({ id: "c", start: "2026-03-12T10:00", customerId: "c2", items: [{ id: "i", serviceId: "s-pedi", price: 120, minutes: 60 }] }),
  ];
  const week = periodRange("7d", NOW);

  it("counts each client once when working out where they came from", () => {
    const sources = leadSources(visits, customers, week);
    expect(sources.map((s) => [s.key, s.value])).toEqual([
      ["instagram", 1],
      ["walkin", 1],
    ]);
  });

  it("ranks services by how often they were done", () => {
    const shares = serviceShares(visits, week);
    expect(shares[0]).toMatchObject({ key: "s-cut", value: 2 });
    expect(shares.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it("counts upcoming bookings per day and ignores cancellations", () => {
    const ahead = bookedAhead([visit({ id: "x", start: "2026-03-16T10:00", status: "confirmed" }), visit({ id: "y", start: "2026-03-16T11:00", status: "cancelled" })], NOW, 3);
    expect(ahead.map((d) => d.count)).toEqual([0, 1, 0]);
  });
});

describe("formatting", () => {
  it("shortens big amounts for chart axes", () => {
    expect(compactMoney(950)).toBe("GH₵ 950");
    expect(compactMoney(18_400)).toBe("GH₵ 18.4k");
    expect(compactMoney(1_250_000)).toBe("GH₵ 1.3m");
  });

  it("says what a change means", () => {
    expect(formatPercentChange(null)).toBe("new");
    expect(formatPercentChange(0)).toBe("no change");
    expect(formatPercentChange(-0.123)).toBe("12%");
  });
});

describe("payments", () => {
  const week = periodRange("7d", NOW);
  const customers: Customer[] = [{ id: "c1", name: "Naa", phone: "", email: "", area: "", memberSince: "", hasAccount: false, points: 0 }];
  const visits = [
    visit({ id: "a", start: "2026-03-14T10:00", payments: [payment(60, "2026-03-14T10:30:00"), { ...payment(40, "2026-03-13T09:00:00"), method: "cash" as const }] }),
    visit({ id: "b", start: "2026-02-01T10:00", payments: [payment(500, "2026-02-01T10:30:00")] }),
  ];

  it("splits money received by method, with how many payments made it up", () => {
    const methods = paymentsByMethod(visits, week);
    expect(methods.map((m) => [m.key, m.value, m.count])).toEqual([
      ["momo", 60, 1],
      ["cash", 40, 1],
    ]);
  });

  it("ranks clients by what they paid in the period only", () => {
    expect(topClients(visits, customers, week)).toEqual([{ customer: customers[0], amount: 100, visits: 1 }]);
  });
});
