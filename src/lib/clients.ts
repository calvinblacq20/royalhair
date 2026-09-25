import type { Customer, LeadSource, Visit } from "../data/types";
import { normalizeGhPhone } from "./contact";
import { localIso } from "./format";
import { rebookDueList } from "./metrics";
import { balanceDue, isActive, paidTotal } from "./visits";

/* The client list on the salon side: one row per client, then search, filters and sort. Pure functions. */

export const PAGE_SIZE = 20;

export interface ClientRow {
  customer: Customer;
  visits: number;
  spend: number;
  owed: number;
  upcoming: number;
  lastVisitAt: string | null;
  /** Day key the client is due back, when their usual service is due and nothing is booked. */
  dueBack: string | null;
}

export function clientRows(customers: Customer[], visits: Visit[], now: Date): ClientRow[] {
  const due = new Map(rebookDueList(visits, now, 14).map((lead) => [lead.customerId, lead.due]));
  const nowKey = localIso(now);
  return customers.map((customer) => {
    const theirs = visits.filter((v) => v.customerId === customer.id);
    const done = theirs.filter((v) => v.status === "done").sort((a, b) => b.start.localeCompare(a.start));
    return {
      customer,
      visits: theirs.filter((v) => v.status !== "cancelled").length,
      spend: theirs.reduce((sum, v) => sum + paidTotal(v), 0),
      owed: theirs.filter((v) => v.status === "done" || v.status === "in-chair").reduce((sum, v) => sum + balanceDue(v), 0),
      upcoming: theirs.filter((v) => isActive(v) && v.start >= nowKey).length,
      lastVisitAt: done[0]?.start ?? null,
      dueBack: due.get(customer.id) ?? null,
    };
  });
}

export type ClientSort = "recent" | "name" | "spend" | "visits";

export const CLIENT_SORT_OPTIONS: { id: ClientSort; label: string }[] = [
  { id: "recent", label: "Last visit" },
  { id: "spend", label: "Most spent" },
  { id: "visits", label: "Most visits" },
  { id: "name", label: "Name" },
];

export interface ClientFilters {
  q: string;
  sort: ClientSort;
  owes: boolean;
  upcoming: boolean;
  dueBack: boolean;
  sources: LeadSource[];
  areas: string[];
}

export const DEFAULT_CLIENT_FILTERS: ClientFilters = { q: "", sort: "recent", owes: false, upcoming: false, dueBack: false, sources: [], areas: [] };

const SOURCES: LeadSource[] = ["instagram", "tiktok", "walkin", "referral", "app"];
const SORTS = CLIENT_SORT_OPTIONS.map((o) => o.id);

export function parseClientFilters(params: URLSearchParams): ClientFilters {
  const sort = params.get("sort") as ClientSort | null;
  const list = (key: string) => (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    q: params.get("q") ?? "",
    sort: sort && SORTS.includes(sort) ? sort : "recent",
    owes: params.get("owes") === "1",
    upcoming: params.get("upcoming") === "1",
    // "view=rebook" is the link the attention bell and Today use.
    dueBack: params.get("due") === "1" || params.get("view") === "rebook",
    sources: list("source").filter((s): s is LeadSource => SOURCES.includes(s as LeadSource)),
    areas: list("area"),
  };
}

export function clientFiltersToParams(f: ClientFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.sort !== "recent") p.set("sort", f.sort);
  if (f.owes) p.set("owes", "1");
  if (f.upcoming) p.set("upcoming", "1");
  if (f.dueBack) p.set("due", "1");
  if (f.sources.length) p.set("source", f.sources.join(","));
  if (f.areas.length) p.set("area", f.areas.join(","));
  return p;
}

export function filterClients(rows: ClientRow[], f: ClientFilters): ClientRow[] {
  const q = f.q.trim().toLowerCase();
  const digits = normalizeGhPhone(q) ?? q.replace(/\D/g, "");
  const out = rows.filter((row) => {
    const c = row.customer;
    if (f.owes && row.owed <= 0) return false;
    if (f.upcoming && row.upcoming === 0) return false;
    if (f.dueBack && !row.dueBack) return false;
    if (f.sources.length && !f.sources.includes(c.source ?? "app")) return false;
    if (f.areas.length && !f.areas.includes(c.area)) return false;
    if (!q) return true;
    const phone = normalizeGhPhone(c.phone) ?? c.phone.replace(/\D/g, "");
    return c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q) || (digits.length >= 3 && phone.includes(digits));
  });
  const by: Record<ClientSort, (a: ClientRow, b: ClientRow) => number> = {
    recent: (a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? "") || a.customer.name.localeCompare(b.customer.name),
    name: (a, b) => a.customer.name.localeCompare(b.customer.name),
    spend: (a, b) => b.spend - a.spend,
    visits: (a, b) => b.visits - a.visits,
  };
  return out.sort(by[f.sort]);
}
