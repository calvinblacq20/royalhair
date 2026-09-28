import type { Branch, Service, Staff, Visit } from "../data/types";
import { dayKey, localIso, parseLocal } from "./format";

/** Visits in these states no longer hold their slot. */
const RELEASED: Visit["status"][] = ["cancelled", "no-show"];

export function holdsSlot(visit: Pick<Visit, "status">): boolean {
  return !RELEASED.includes(visit.status);
}

export interface Span {
  start: Date;
  end: Date;
}

export function spanOf(visit: Pick<Visit, "start" | "minutes">): Span {
  const start = parseLocal(visit.start);
  return { start, end: new Date(start.getTime() + visit.minutes * 60_000) };
}

/** True when two spans share any minute. Touching end-to-start is not an overlap. */
export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Minutes a branch is open on a given day, or null when it is closed. */
export function openingOn(branch: Branch, day: Date): Span | null {
  const hours = branch.hours[day.getDay()];
  if (!hours) return null;
  const [open, close] = hours;
  return { start: parseLocal(`${dayKey(day)}T${open}`), end: parseLocal(`${dayKey(day)}T${close}`) };
}

export function staffWorksOn(staff: Staff, day: Date): boolean {
  return staff.active && staff.days.includes(day.getDay());
}

/** Staff who can take every service in the list, at this branch: they cover each group and hold a role the service allows. */
export function staffFor(all: Staff[], branchId: string, services: Pick<Service, "group" | "roles">[]): Staff[] {
  return all.filter((s) => s.active && s.branchId === branchId && services.every((svc) => s.groups.includes(svc.group) && (!svc.roles || svc.roles.includes(s.role))));
}

export function totalMinutes(services: Service[], turnaroundMinutes = 0): number {
  return services.reduce((sum, s) => sum + s.minutes, 0) + turnaroundMinutes;
}

/**
 * The one rule that matters: a staff member cannot be in two places at once.
 * Returns the visit that clashes, or null when the slot is free.
 *
 * `ignoreVisitId` lets a visit be rescheduled without clashing with itself.
 * `gapMinutes` keeps that much clean-down time free after every visit, the new one included.
 */
export function findClash(
  visits: Visit[],
  staffId: string,
  span: Span,
  ignoreVisitId?: string,
  gapMinutes = 0,
): Visit | null {
  const pad = gapMinutes * 60_000;
  const wanted = { start: span.start, end: new Date(span.end.getTime() + pad) };
  for (const visit of visits) {
    if (visit.id === ignoreVisitId) continue;
    if (visit.staffId !== staffId) continue;
    if (!holdsSlot(visit)) continue;
    const taken = spanOf(visit);
    if (overlaps(wanted, { start: taken.start, end: new Date(taken.end.getTime() + pad) })) return visit;
  }
  return null;
}

export interface SlotOptions {
  /** How far apart offered start times are. */
  stepMinutes?: number;
  /** Slots starting sooner than this many minutes from now are not offered. */
  leadMinutes?: number;
  /** Clean-down minutes kept free between visits. */
  gapMinutes?: number;
}

/**
 * Every start time on `day` that fits `minutes` of work for `staff`, inside branch hours,
 * with nothing else booked and not already in the past.
 */
export function slotsFor(
  args: { branch: Branch; staff: Staff; day: Date; minutes: number; visits: Visit[]; now: Date },
  options: SlotOptions = {},
): string[] {
  const { branch, staff, day, minutes, visits, now } = args;
  const { stepMinutes = 30, leadMinutes = 60, gapMinutes = 0 } = options;

  if (minutes <= 0) return [];
  const opening = openingOn(branch, day);
  if (!opening || !staffWorksOn(staff, day)) return [];

  const earliest = new Date(now.getTime() + leadMinutes * 60_000);
  const step = stepMinutes * 60_000;
  const slots: string[] = [];

  for (let t = opening.start.getTime(); t + minutes * 60_000 <= opening.end.getTime(); t += step) {
    const start = new Date(t);
    if (start < earliest) continue;
    const span = { start, end: new Date(t + minutes * 60_000) };
    if (findClash(visits, staff.id, span, undefined, gapMinutes)) continue;
    slots.push(localIso(start));
  }
  return slots;
}

export interface Availability {
  staff: Staff;
  slots: string[];
}

/** Availability for every staff member who can do the work, busiest last. */
export function availabilityFor(args: {
  branch: Branch;
  staff: Staff[];
  day: Date;
  minutes: number;
  visits: Visit[];
  now: Date;
}, options?: SlotOptions): Availability[] {
  return args.staff
    .map((staff) => ({ staff, slots: slotsFor({ ...args, staff }, options) }))
    .filter((entry) => entry.slots.length > 0);
}

/**
 * "First available" picks the person with the lightest day, not the first in the list,
 * so work spreads across the floor instead of piling onto one stylist.
 */
export function leastBusy(staff: Staff[], visits: Visit[], day: Date): Staff | null {
  const key = dayKey(day);
  const load = (id: string) =>
    visits
      .filter((v) => v.staffId === id && holdsSlot(v) && v.start.startsWith(key))
      .reduce((sum, v) => sum + v.minutes, 0);
  return [...staff].sort((a, b) => load(a.id) - load(b.id) || a.name.localeCompare(b.name))[0] ?? null;
}

/** The day key a client is due back, from the longest repeat interval on the visit. */
export function rebookDue(services: Service[], start: Date): string | undefined {
  const weeks = Math.max(0, ...services.map((s) => s.repeatWeeks));
  if (!weeks) return undefined;
  const due = new Date(start);
  due.setDate(due.getDate() + weeks * 7);
  return dayKey(due);
}

/** Returns an error message, or null when this booking can be written. */
export function validateSlot(args: {
  branch: Branch;
  staff: Staff;
  start: Date;
  minutes: number;
  visits: Visit[];
  now: Date;
  ignoreVisitId?: string;
  gapMinutes?: number;
}): string | null {
  const { branch, staff, start, minutes, visits, now, ignoreVisitId, gapMinutes = 0 } = args;
  if (minutes <= 0) return "Choose at least one service.";
  if (start < now) return "That time has already passed.";

  const opening = openingOn(branch, start);
  if (!opening) return `${branch.name} is closed that day.`;
  const end = new Date(start.getTime() + minutes * 60_000);
  if (start < opening.start || end > opening.end) return `That doesn't fit inside ${branch.name}'s opening hours.`;
  if (!staffWorksOn(staff, start)) return `${staff.name} doesn't work that day.`;

  if (findClash(visits, staff.id, { start, end }, ignoreVisitId)) return `${staff.name} was just booked for that time. Please pick another slot.`;
  if (gapMinutes > 0 && findClash(visits, staff.id, { start, end }, ignoreVisitId, gapMinutes)) {
    return `${staff.name} needs ${gapMinutes} minutes between clients to clean down. Please pick another slot.`;
  }
  return null;
}
