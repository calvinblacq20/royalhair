import { addDays, startOfDay, weekdayLong } from "./format";

/** Opening hours by weekday (0 = Sunday). null = closed. A branch's `hours` array fits this shape. */
export type Hours = Readonly<Record<number, readonly [open: string, close: string] | null>>;

function at(day: Date, hhmm: string): Date {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export interface OpenStatus {
  open: boolean;
  label: string;
}

export function openStatus(now: Date, hours: Hours): OpenStatus {
  const today = hours[now.getDay()];
  if (today && now >= at(now, today[0]) && now < at(now, today[1])) {
    return { open: true, label: `Open · closes at ${today[1]}` };
  }
  for (let offset = 0; offset < 8; offset++) {
    const day = addDays(startOfDay(now), offset);
    const span = hours[day.getDay()];
    if (!span) continue;
    const opens = at(day, span[0]);
    if (opens <= now) continue;
    const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : `on ${weekdayLong(day)}`;
    return { open: false, label: `Closed · opens ${when} at ${span[0]}` };
  }
  return { open: false, label: "Closed" };
}

export function dateStrip(from: Date, count: number): Date[] {
  const first = startOfDay(from);
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}
