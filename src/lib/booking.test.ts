import { describe, expect, it } from "vitest";
import type { Branch, Service, Staff, Visit } from "../data/types";
import { availabilityFor, findClash, leastBusy, openingOn, overlaps, rebookDue, slotsFor, spanOf, staffFor, totalMinutes, validateSlot } from "./booking";
import { parseLocal } from "./format";

/** Monday 5 January 2026, 08:00. Every test works from this fixed point. */
const MONDAY = parseLocal("2026-01-05T08:00");

const branch: Branch = {
  id: "b1",
  name: "West Hills Mall",
  area: "Weija",
  address: "West Hills Mall",
  phone: "030 396 5412",
  // Sunday closed, weekdays 09:00–17:00.
  hours: [null, ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"]],
  chairs: 4,
  active: true,
};

const stylist: Staff = { id: "st1", name: "Adwoa", branchId: "b1", role: "stylist", groups: ["hair"], days: [1, 2, 3, 4, 5, 6], commission: 0.35, active: true };
const barber: Staff = { id: "st2", name: "Kwabena", branchId: "b1", role: "barber", groups: ["barbering"], days: [1, 2, 3, 4, 5, 6], commission: 0.4, active: true };
const allRounder: Staff = { id: "st3", name: "Gifty", branchId: "b1", role: "manager", groups: ["hair", "barbering"], days: [1], commission: 0.2, active: true };

const service = (id: string, minutes: number, group: Service["group"] = "hair", repeatWeeks = 0): Service => ({
  id, name: id, group, description: "", price: 100, minutes, bookable: true, repeatWeeks, tone: "magenta",
});

function visit(partial: Partial<Visit> & Pick<Visit, "id" | "staffId" | "start" | "minutes">): Visit {
  return {
    number: "RH-0001",
    customerId: "c1",
    branchId: "b1",
    items: [],
    createdAt: "2026-01-01T00:00",
    status: "confirmed",
    history: [],
    source: "online",
    total: 100,
    payments: [],
    ...partial,
  };
}

describe("overlaps", () => {
  const span = (from: string, to: string) => ({ start: parseLocal(from), end: parseLocal(to) });

  it("finds a real overlap", () => {
    expect(overlaps(span("2026-01-05T09:00", "2026-01-05T10:00"), span("2026-01-05T09:30", "2026-01-05T10:30"))).toBe(true);
  });

  it("treats back-to-back bookings as free", () => {
    expect(overlaps(span("2026-01-05T09:00", "2026-01-05T10:00"), span("2026-01-05T10:00", "2026-01-05T11:00"))).toBe(false);
  });

  it("catches a booking swallowed by a longer one", () => {
    expect(overlaps(span("2026-01-05T09:00", "2026-01-05T13:00"), span("2026-01-05T10:00", "2026-01-05T10:30"))).toBe(true);
  });
});

describe("findClash", () => {
  const booked = visit({ id: "v1", staffId: "st1", start: "2026-01-05T10:00", minutes: 60 });
  const span = { start: parseLocal("2026-01-05T10:30"), end: parseLocal("2026-01-05T11:30") };

  it("reports the clashing visit", () => {
    expect(findClash([booked], "st1", span)?.id).toBe("v1");
  });

  it("ignores another staff member's diary", () => {
    expect(findClash([booked], "st2", span)).toBeNull();
  });

  it("ignores cancelled and no-show visits, which release their slot", () => {
    expect(findClash([{ ...booked, status: "cancelled" }], "st1", span)).toBeNull();
    expect(findClash([{ ...booked, status: "no-show" }], "st1", span)).toBeNull();
  });

  it("lets a visit be rescheduled without clashing with itself", () => {
    expect(findClash([booked], "st1", span, "v1")).toBeNull();
  });
});

describe("openingOn", () => {
  it("returns null on a closed day", () => {
    expect(openingOn(branch, parseLocal("2026-01-04T10:00"))).toBeNull(); // Sunday
  });

  it("returns the day's hours", () => {
    const open = openingOn(branch, MONDAY);
    expect(open && spanOf({ start: "2026-01-05T09:00", minutes: 480 }).start.getTime()).toBe(open?.start.getTime());
  });
});

describe("slotsFor", () => {
  const args = { branch, staff: stylist, day: MONDAY, minutes: 60, visits: [] as Visit[], now: MONDAY };

  it("offers every half hour that fits inside opening hours", () => {
    const slots = slotsFor(args, { leadMinutes: 0 });
    expect(slots[0]).toBe("2026-01-05T09:00");
    // The last hour-long slot has to end by 17:00.
    expect(slots[slots.length - 1]).toBe("2026-01-05T16:00");
  });

  it("does not offer a slot that would run past closing", () => {
    const slots = slotsFor({ ...args, minutes: 240 }, { leadMinutes: 0 });
    expect(slots[slots.length - 1]).toBe("2026-01-05T13:00");
  });

  it("skips slots taken by an existing visit", () => {
    const slots = slotsFor({ ...args, visits: [visit({ id: "v1", staffId: "st1", start: "2026-01-05T10:00", minutes: 60 })] }, { leadMinutes: 0 });
    expect(slots).not.toContain("2026-01-05T09:30");
    expect(slots).not.toContain("2026-01-05T10:00");
    expect(slots).toContain("2026-01-05T11:00");
  });

  it("respects the lead time so nobody books for five minutes' time", () => {
    const now = parseLocal("2026-01-05T09:10");
    const slots = slotsFor({ ...args, now }, { leadMinutes: 60 });
    expect(slots[0]).toBe("2026-01-05T10:30");
  });

  it("returns nothing when the branch is closed or the staff member is off", () => {
    expect(slotsFor({ ...args, day: parseLocal("2026-01-04T09:00") }, { leadMinutes: 0 })).toEqual([]);
    expect(slotsFor({ ...args, staff: allRounder, day: parseLocal("2026-01-06T09:00") }, { leadMinutes: 0 })).toEqual([]);
  });

  it("returns nothing for an empty basket", () => {
    expect(slotsFor({ ...args, minutes: 0 }, { leadMinutes: 0 })).toEqual([]);
  });
});

describe("staffFor", () => {
  it("only offers staff who can do every service in the basket", () => {
    const both = [service("a", 60, "hair"), service("b", 30, "barbering")];
    expect(staffFor([stylist, barber, allRounder], "b1", both).map((s) => s.id)).toEqual(["st3"]);
  });

  it("excludes staff from other branches", () => {
    expect(staffFor([{ ...stylist, branchId: "b2" }], "b1", [service("a", 60)])).toEqual([]);
  });
});

describe("availabilityFor", () => {
  it("leaves out anyone with no free slots", () => {
    const fullDay = visit({ id: "v1", staffId: "st1", start: "2026-01-05T09:00", minutes: 480 });
    const result = availabilityFor({ branch, staff: [stylist, allRounder], day: MONDAY, minutes: 60, visits: [fullDay], now: MONDAY }, { leadMinutes: 0 });
    expect(result.map((a) => a.staff.id)).toEqual(["st3"]);
  });
});

describe("leastBusy", () => {
  it("picks the stylist with the lightest day, not the first in the list", () => {
    const visits = [visit({ id: "v1", staffId: "st1", start: "2026-01-05T09:00", minutes: 240 })];
    expect(leastBusy([stylist, barber], visits, MONDAY)?.id).toBe("st2");
  });

  it("does not count released slots against someone", () => {
    const visits = [visit({ id: "v1", staffId: "st1", start: "2026-01-05T09:00", minutes: 240, status: "cancelled" })];
    // Both are free, so it falls back to the alphabetical tie-break.
    expect(leastBusy([barber, stylist], visits, MONDAY)?.name).toBe("Adwoa");
  });
});

describe("totalMinutes", () => {
  it("adds the services and the clean-down time", () => {
    expect(totalMinutes([service("a", 60), service("b", 45)], 10)).toBe(115);
  });
});

describe("rebookDue", () => {
  it("uses the longest repeat interval on the visit", () => {
    expect(rebookDue([service("a", 60, "hair", 4), service("b", 30, "hair", 10)], MONDAY)).toBe("2026-03-16");
  });

  it("is undefined when nothing has a natural repeat", () => {
    expect(rebookDue([service("a", 60, "hair", 0)], MONDAY)).toBeUndefined();
  });
});

describe("validateSlot", () => {
  const base = { branch, staff: stylist, minutes: 60, visits: [] as Visit[], now: MONDAY };

  it("accepts a free slot inside opening hours", () => {
    expect(validateSlot({ ...base, start: parseLocal("2026-01-05T10:00") })).toBeNull();
  });

  it("rejects a time in the past", () => {
    expect(validateSlot({ ...base, start: parseLocal("2026-01-05T07:00") })).toMatch(/already passed/);
  });

  it("rejects a closed day", () => {
    expect(validateSlot({ ...base, start: parseLocal("2026-01-04T10:00"), now: parseLocal("2026-01-03T08:00") })).toMatch(/closed/);
  });

  it("rejects work that would run past closing", () => {
    expect(validateSlot({ ...base, start: parseLocal("2026-01-05T16:30") })).toMatch(/opening hours/);
  });

  it("rejects a day the staff member does not work", () => {
    expect(validateSlot({ ...base, staff: allRounder, start: parseLocal("2026-01-06T10:00") })).toMatch(/doesn't work/);
  });

  it("rejects a slot that was taken while the client was choosing", () => {
    const visits = [visit({ id: "v1", staffId: "st1", start: "2026-01-05T10:30", minutes: 60 })];
    expect(validateSlot({ ...base, visits, start: parseLocal("2026-01-05T10:00") })).toMatch(/just booked/);
  });

  it("rejects an empty basket", () => {
    expect(validateSlot({ ...base, minutes: 0, start: parseLocal("2026-01-05T10:00") })).toMatch(/at least one service/);
  });
});
