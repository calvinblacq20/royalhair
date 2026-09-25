const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** GH₵ 1,500 or GH₵ 12.50 */
export function money(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const [int = "0", frac = "00"] = Math.abs(amount).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}GH₵ ${grouped}${frac === "00" ? "" : `.${frac}`}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in local time. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses YYYY-MM-DD or YYYY-MM-DDTHH:mm as local time. */
export function parseLocal(value: string): Date {
  const [datePart = "", timePart = "00:00"] = value.split("T");
  const [y = 0, m = 1, d = 1] = datePart.split("-").map(Number);
  const [hh = 0, mm = 0] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** YYYY-MM-DDTHH:mm in local time. */
export function localIso(date: Date): string {
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Tue, 15 Sept 2026 */
export function fmtDay(date: Date): string {
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Tue, 15 Sept */
export function fmtDayShort(date: Date): string {
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Tuesday 15 September */
export function fmtDayLong(date: Date): string {
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
}

/** 15 Sept 2026 */
export function fmtDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function fmtTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function weekdayShort(date: Date): string {
  return DAYS[date.getDay()] ?? "";
}

export function weekdayLong(date: Date): string {
  return DAYS_LONG[date.getDay()] ?? "";
}

export function monthShort(date: Date): string {
  return MONTHS[date.getMonth()] ?? "";
}

export function monthLong(date: Date): string {
  return MONTHS_LONG[date.getMonth()] ?? "";
}

/** Today / Tomorrow / Yesterday / Tue, 15 Sept */
export function relativeDay(date: Date, now: Date): string {
  const diff = daysBetween(now, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fmtDayShort(date);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
