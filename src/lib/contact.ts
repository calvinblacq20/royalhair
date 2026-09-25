/** Normalises Ghanaian numbers to international digits (233XXXXXXXXX), or null if invalid. */
export function normalizeGhPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^233\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^[235]\d{8}$/.test(digits)) return `233${digits}`;
  return null;
}

/** 024 851 5773 */
export function formatGhPhone(input: string): string {
  const normalized = normalizeGhPhone(input);
  if (!normalized) return input;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function whatsappLink(phone: string, text: string): string {
  const normalized = normalizeGhPhone(phone);
  const base = normalized ? `https://wa.me/${normalized}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string {
  const normalized = normalizeGhPhone(phone);
  return normalized ? `tel:+${normalized}` : `tel:${phone}`;
}

export function mapsLinks(query: string): { google: string; apple: string } {
  const q = encodeURIComponent(query);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
  };
}

export interface CalendarEvent {
  title: string;
  start: Date;
  minutes: number;
  location: string;
  details: string;
}

const stamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;

export function googleCalendarLink(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + event.minutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(event.start)}/${stamp(end)}`,
    ctz: "Africa/Accra",
    location: event.location,
    details: event.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function icsFile(event: CalendarEvent, uid: string, now: Date): string {
  const end = new Date(event.start.getTime() + event.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Franz Qlodin//Studio//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;TZID=Africa/Accra:${stamp(event.start)}`,
    `DTEND;TZID=Africa/Accra:${stamp(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `LOCATION:${icsEscape(event.location)}`,
    `DESCRIPTION:${icsEscape(event.details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
