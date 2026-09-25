import { GROUP_LABEL, serviceById } from "../data/catalog";
import type { Customer, LeadSource, PaymentMethod, Visit } from "../data/types";
import { addDays, monthShort, parseLocal, startOfDay } from "./format";

/* Numbers for the owner's trend charts and reports. Every function is pure: data in, numbers out. */

export type PeriodId = "7d" | "30d" | "90d" | "year";

export const PERIODS: { id: PeriodId; label: string; short: string }[] = [
  { id: "7d", label: "Last 7 days", short: "7 days" },
  { id: "30d", label: "Last 30 days", short: "30 days" },
  { id: "90d", label: "Last 90 days", short: "90 days" },
  { id: "year", label: "Last 12 months", short: "12 months" },
];

export const periodLabel = (id: PeriodId) => PERIODS.find((p) => p.id === id)?.label ?? "";
export const isPeriodId = (value: string | null): value is PeriodId => PERIODS.some((p) => p.id === value);

/** Half-open time range: start ≤ t < end. */
export interface Range {
  start: Date;
  end: Date;
}

export interface Bucket extends Range {
  label: string;
}

const DAYS: Record<Exclude<PeriodId, "year">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function periodRange(id: PeriodId, now: Date): Range {
  const end = addDays(startOfDay(now), 1);
  if (id === "year") return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end };
  return { start: addDays(end, -DAYS[id]), end };
}

/** The period of the same length just before this one. */
export function previousRange(id: PeriodId, range: Range): Range {
  if (id === "year") return { start: new Date(range.start.getFullYear(), range.start.getMonth() - 12, 1), end: range.start };
  return { start: addDays(range.start, -DAYS[id]), end: range.start };
}

/** Days for 7 and 30 days, weeks for 90 days, months for a year. */
export function bucketsFor(id: PeriodId, range: Range): Bucket[] {
  const buckets: Bucket[] = [];
  if (id === "year") {
    for (let i = 0; i < 12; i++) {
      const start = new Date(range.start.getFullYear(), range.start.getMonth() + i, 1);
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push({ start, end: next < range.end ? next : range.end, label: monthShort(start) });
    }
    return buckets;
  }
  const step = id === "90d" ? 7 : 1;
  for (let start = range.start; start < range.end; start = addDays(start, step)) {
    const next = addDays(start, step);
    buckets.push({ start, end: next < range.end ? next : range.end, label: `${start.getDate()} ${monthShort(start)}` });
  }
  return buckets;
}

const inRange = (t: Date, r: Range) => t >= r.start && t < r.end;
const isoIn = (iso: string, r: Range) => inRange(new Date(iso), r);

/* ---------------- Metrics ---------------- */

export type MetricId = "cash" | "visits" | "noShows" | "avgSpend" | "newClients";
export type MetricFormat = "money" | "count" | "percent";

export interface MetricDef {
  id: MetricId;
  label: string;
  /** Which direction is good news. */
  good: "up" | "down";
  format: MetricFormat;
  /** Short line under the chart. */
  hint: string;
}

export const METRICS: Record<MetricId, MetricDef> = {
  cash: { id: "cash", label: "Cash received", good: "up", format: "money", hint: "Deposits and payments: MoMo, cash, card and bank" },
  visits: { id: "visits", label: "Visits done", good: "up", format: "count", hint: "Clients who finished a visit" },
  noShows: { id: "noShows", label: "No-shows", good: "down", format: "count", hint: "Booked clients who didn't come" },
  avgSpend: { id: "avgSpend", label: "Average spend", good: "up", format: "money", hint: "Average bill of finished visits" },
  newClients: { id: "newClients", label: "New clients", good: "up", format: "count", hint: "Clients on their first visit" },
};

/** The metric's value for a range. */
export function metricValue(id: MetricId, visits: Visit[], r: Range): number | null {
  switch (id) {
    case "cash":
      return visits.reduce((sum, v) => sum + v.payments.reduce((s, p) => (isoIn(p.at, r) ? s + p.amount : s), 0), 0);
    case "visits":
      return visits.filter((v) => v.status === "done" && inRange(parseLocal(v.start), r)).length;
    case "noShows":
      return visits.filter((v) => v.status === "no-show" && inRange(parseLocal(v.start), r)).length;
    case "avgSpend": {
      const done = visits.filter((v) => v.status === "done" && inRange(parseLocal(v.start), r));
      return done.length ? Math.round(done.reduce((s, v) => s + v.total, 0) / done.length) : null;
    }
    case "newClients": {
      const firstVisit = new Map<string, Date>();
      for (const v of visits) {
        if (v.status === "cancelled") continue;
        const start = parseLocal(v.start);
        const known = firstVisit.get(v.customerId);
        if (!known || start < known) firstVisit.set(v.customerId, start);
      }
      return [...firstVisit.values()].filter((d) => inRange(d, r)).length;
    }
  }
}

export function metricSeries(id: MetricId, visits: Visit[], buckets: Bucket[], now: Date): (number | null)[] {
  return buckets.map((b) => (b.start > now ? null : metricValue(id, visits, b)));
}

export type DeltaTone = "good" | "bad" | "neutral";

export interface Delta {
  /** Fractional change, e.g. 0.12 for +12%. Null when there's nothing to compare with. */
  change: number | null;
  direction: "up" | "down" | "flat";
  tone: DeltaTone;
}

export function delta(current: number | null, previous: number | null, good: "up" | "down"): Delta {
  if (current === null || previous === null) return { change: null, direction: "flat", tone: "neutral" };
  if (current === previous) return { change: 0, direction: "flat", tone: "neutral" };
  const direction = current > previous ? "up" : "down";
  const change = previous === 0 ? null : (current - previous) / Math.abs(previous);
  if (change !== null && Math.abs(change) < 0.005) return { change: 0, direction: "flat", tone: "neutral" };
  return { change, direction, tone: direction === good ? "good" : "bad" };
}

export interface Kpi {
  def: MetricDef;
  value: number | null;
  previous: number | null;
  delta: Delta;
  series: (number | null)[];
  previousSeries: (number | null)[];
}

export function kpi(id: MetricId, visits: Visit[], period: PeriodId, now: Date): Kpi {
  const range = periodRange(period, now);
  const prev = previousRange(period, range);
  const def = METRICS[id];
  const value = metricValue(id, visits, range);
  const previous = metricValue(id, visits, prev);
  return {
    def,
    value,
    previous,
    delta: delta(value, previous, def.good),
    series: metricSeries(id, visits, bucketsFor(period, range), now),
    previousSeries: metricSeries(id, visits, bucketsFor(period, prev), now),
  };
}

/* ---------------- Shares ---------------- */

export interface Share<K extends string = string> {
  key: K;
  label: string;
  value: number;
  /** 0–1 of the total. */
  share: number;
  /** How many entries made up the value (payments, visits). */
  count: number;
}

function toShares<K extends string>(counts: Map<K, number>, label: (key: K) => string, tallies?: Map<K, number>): Share<K>[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([key, value]) => ({ key, label: label(key), value, share: total ? value / total : 0, count: tallies?.get(key) ?? value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Services on finished visits in the range, most booked first. */
export function serviceShares(visits: Visit[], r: Range): Share[] {
  const counts = new Map<string, number>();
  for (const v of visits) {
    if (v.status !== "done" || !inRange(parseLocal(v.start), r)) continue;
    for (const item of v.items) counts.set(item.serviceId, (counts.get(item.serviceId) ?? 0) + 1);
  }
  return toShares(counts, (id) => serviceById(id)?.name ?? "Removed service");
}

/** Barbershop, hair, nails, spa and kids, by finished visits in the range. */
export function groupShares(visits: Visit[], r: Range): Share[] {
  const counts = new Map<string, number>();
  for (const v of visits) {
    if (v.status !== "done" || !inRange(parseLocal(v.start), r)) continue;
    for (const item of v.items) {
      const group = serviceById(item.serviceId)?.group;
      if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return toShares(counts, (g) => GROUP_LABEL[g as keyof typeof GROUP_LABEL] ?? g);
}

export const SOURCE_LABEL: Record<LeadSource, string> = { instagram: "Instagram", tiktok: "TikTok", walkin: "Walked in", referral: "Referral", app: "Booked online" };

/** Where the clients who came in during the range first found the salon. */
export function leadSources(visits: Visit[], customers: Customer[], r: Range): Share<LeadSource>[] {
  const seen = new Set<string>();
  const counts = new Map<LeadSource, number>();
  for (const v of visits) {
    if (v.status === "cancelled" || !inRange(parseLocal(v.start), r) || seen.has(v.customerId)) continue;
    seen.add(v.customerId);
    const source = customers.find((c) => c.id === v.customerId)?.source ?? "app";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return toShares(counts, (k) => SOURCE_LABEL[k]);
}

export const METHOD_LABEL: Record<PaymentMethod, string> = { momo: "Mobile Money", cash: "Cash", card: "Card", bank: "Bank transfer" };

/** Money received in the range, split by how it was paid. */
export function paymentsByMethod(visits: Visit[], r: Range): Share<PaymentMethod>[] {
  const amounts = new Map<PaymentMethod, number>();
  const counts = new Map<PaymentMethod, number>();
  for (const v of visits) {
    for (const p of v.payments) {
      if (!isoIn(p.at, r)) continue;
      amounts.set(p.method, (amounts.get(p.method) ?? 0) + p.amount);
      counts.set(p.method, (counts.get(p.method) ?? 0) + 1);
    }
  }
  return toShares(amounts, (k) => METHOD_LABEL[k], counts);
}

export interface ClientSpend {
  customer: Customer;
  amount: number;
  visits: number;
}

/** The clients who paid the most in the range. */
export function topClients(visits: Visit[], customers: Customer[], r: Range): ClientSpend[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const totals = new Map<string, { amount: number; visits: Set<string> }>();
  for (const v of visits) {
    for (const p of v.payments) {
      if (!isoIn(p.at, r)) continue;
      const t = totals.get(v.customerId) ?? { amount: 0, visits: new Set<string>() };
      t.amount += p.amount;
      t.visits.add(v.id);
      totals.set(v.customerId, t);
    }
  }
  return [...totals.entries()]
    .flatMap(([id, t]) => {
      const customer = byId.get(id);
      return customer ? [{ customer, amount: t.amount, visits: t.visits.size }] : [];
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Booked visits per day ahead, for the "next 14 days" bar chart. */
export function bookedAhead(visits: Visit[], now: Date, days = 14): { date: Date; count: number }[] {
  const first = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(first, i);
    const next = addDays(date, 1);
    const count = visits.filter((v) => v.status !== "cancelled" && v.status !== "no-show" && inRange(parseLocal(v.start), { start: date, end: next })).length;
    return { date, count };
  });
}

/* ---------------- Formatting ---------------- */

/** GH₵ 18.4k for chart axes and small cards. */
export function compactMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `GH₵ ${trim(amount / 1_000_000)}m`;
  if (abs >= 1_000) return `GH₵ ${trim(amount / 1_000)}k`;
  return `GH₵ ${Math.round(amount)}`;
}

const trim = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

export function formatPercentChange(change: number | null): string {
  if (change === null) return "new";
  if (change === 0) return "no change";
  return `${Math.round(Math.abs(change) * 100)}%`;
}
