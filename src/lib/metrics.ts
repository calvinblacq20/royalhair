import { serviceById } from "../data/catalog";
import type { Branch, Staff, Visit } from "../data/types";
import { holdsSlot, openingOn } from "./booking";
import { dayKey, parseLocal, startOfDay } from "./format";
import { commissionFor } from "./pricing";
import { paidTotal } from "./visits";

const onDay = (visit: Visit, day: string) => visit.start.startsWith(day);

export function visitsOnDay(visits: Visit[], day: Date, branchId?: string): Visit[] {
  const key = dayKey(day);
  return visits
    .filter((v) => onDay(v, key) && (!branchId || v.branchId === branchId))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Money actually taken on a day, whatever visit it was against. */
export function takingsOnDay(visits: Visit[], day: Date, branchId?: string): number {
  const key = dayKey(day);
  return visits
    .filter((v) => !branchId || v.branchId === branchId)
    .flatMap((v) => v.payments)
    .filter((p) => p.at.slice(0, 10) === key)
    .reduce((sum, p) => sum + p.amount, 0);
}

export interface DayBoard {
  now: Visit[];
  next: Visit[];
  waiting: Visit[];
  done: Visit[];
  missed: Visit[];
  takings: number;
  booked: number;
}

/** What the front desk needs to see at a glance, for one branch on one day. */
export function dayBoard(visits: Visit[], day: Date, branchId: string, now: Date): DayBoard {
  const today = visitsOnDay(visits, day, branchId);
  return {
    now: today.filter((v) => v.status === "in-chair"),
    waiting: today.filter((v) => v.status === "arrived"),
    next: today.filter((v) => (v.status === "confirmed" || v.status === "requested") && parseLocal(v.start) >= now),
    done: today.filter((v) => v.status === "done"),
    // No-shows, plus anyone still expected whose start time has already gone.
    missed: today.filter((v) => v.status === "no-show" || ((v.status === "requested" || v.status === "confirmed") && parseLocal(v.start) < now)),
    takings: takingsOnDay(visits, day, branchId),
    booked: today.filter(holdsSlot).reduce((sum, v) => sum + v.minutes, 0),
  };
}

/** Booked minutes as a share of the chair-minutes the branch had available that day. */
export function chairUtilisation(visits: Visit[], branch: Branch, staff: Staff[], day: Date): number {
  const opening = openingOn(branch, day);
  if (!opening) return 0;
  const openMinutes = (opening.end.getTime() - opening.start.getTime()) / 60_000;
  const working = staff.filter((s) => s.active && s.branchId === branch.id && s.days.includes(day.getDay())).length;
  const capacity = openMinutes * Math.min(working, branch.chairs);
  if (capacity <= 0) return 0;
  const booked = visitsOnDay(visits, day, branch.id).filter(holdsSlot).reduce((sum, v) => sum + v.minutes, 0);
  return Math.min(1, booked / capacity);
}

export interface RangeStats {
  revenue: number;
  visits: number;
  noShows: number;
  newClients: number;
  averageSpend: number;
}

export function statsBetween(visits: Visit[], from: Date, to: Date, branchId?: string): RangeStats {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime() + 86_400_000;
  const inRange = visits.filter((v) => {
    if (branchId && v.branchId !== branchId) return false;
    const t = parseLocal(v.start).getTime();
    return t >= start && t < end;
  });
  const completed = inRange.filter((v) => v.status === "done");
  const revenue = completed.reduce((sum, v) => sum + paidTotal(v), 0);
  const seen = new Set<string>();
  for (const visit of inRange) seen.add(visit.customerId);
  return {
    revenue,
    visits: completed.length,
    noShows: inRange.filter((v) => v.status === "no-show").length,
    newClients: seen.size,
    averageSpend: completed.length ? Math.round(revenue / completed.length) : 0,
  };
}

export interface ServiceCount {
  serviceId: string;
  name: string;
  count: number;
  revenue: number;
}

/** Which services actually earn, busiest first. */
export function topServices(visits: Visit[], branchId?: string, limit = 6): ServiceCount[] {
  const tally = new Map<string, ServiceCount>();
  for (const visit of visits) {
    if (branchId && visit.branchId !== branchId) continue;
    if (visit.status !== "done") continue;
    for (const item of visit.items) {
      const name = serviceById(item.serviceId)?.name ?? "Removed service";
      const entry = tally.get(item.serviceId) ?? { serviceId: item.serviceId, name, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += item.price;
      tally.set(item.serviceId, entry);
    }
  }
  return [...tally.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export interface StaffEarnings {
  staff: Staff;
  visits: number;
  revenue: number;
  commission: number;
}

export function earningsByStaff(visits: Visit[], staff: Staff[], from: Date, to: Date): StaffEarnings[] {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime() + 86_400_000;
  return staff
    .map((member) => {
      const theirs = visits.filter((v) => {
        if (v.staffId !== member.id || v.status !== "done") return false;
        const t = parseLocal(v.start).getTime();
        return t >= start && t < end;
      });
      const revenue = theirs.reduce((sum, v) => sum + paidTotal(v), 0);
      return { staff: member, visits: theirs.length, revenue, commission: commissionFor(revenue, member.commission) };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface RebookLead {
  customerId: string;
  visitId: string;
  due: string;
  serviceNames: string;
}

/**
 * Clients whose last visit is now due to be repeated. This is the list that turns
 * a one-off appointment into a regular — see docs/PRD.md.
 */
export function rebookDueList(visits: Visit[], now: Date, withinDays = 14): RebookLead[] {
  const today = dayKey(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + withinDays);
  const limit = dayKey(horizon);

  const latest = new Map<string, Visit>();
  for (const visit of visits) {
    if (visit.status !== "done" || !visit.rebookDue) continue;
    const current = latest.get(visit.customerId);
    if (!current || visit.start > current.start) latest.set(visit.customerId, visit);
  }

  const booked = new Set(visits.filter((v) => holdsSlot(v) && v.start >= today).map((v) => v.customerId));

  return [...latest.values()]
    .filter((v) => v.rebookDue! <= limit && !booked.has(v.customerId))
    .map((v) => ({
      customerId: v.customerId,
      visitId: v.id,
      due: v.rebookDue!,
      serviceNames: v.items.map((i) => serviceById(i.serviceId)?.name ?? "Service").join(", "),
    }))
    .sort((a, b) => a.due.localeCompare(b.due));
}
