import { CalendarPlus, Download } from "lucide-react";
import { SALON } from "../data/business";
import { AppIcon } from "./Brand";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { googleCalendarLink, icsFile, type CalendarEvent } from "../lib/contact";
import { fmtDayLong, fmtTime } from "../lib/format";

export function CalendarSheet({ open, onClose, event, uid }: { open: boolean; onClose: () => void; event: CalendarEvent | null; uid: string }) {
  if (!event) return null;
  const downloadIcs = () => {
    const blob = new Blob([icsFile(event, uid, new Date())], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${uid}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add to calendar">
      <div className="stack gap-16">
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--ground)", boxShadow: "none" }}>
          <AppIcon size={48} />
          <div className="stack">
            <p className="t-title">{event.title}</p>
            <p className="muted">
              {fmtDayLong(event.start)} at {fmtTime(event.start)}
            </p>
            <p className="subtle t-cap">{event.location || SALON.area}</p>
          </div>
        </div>
        <a className="btn btn-outline btn-block" href={googleCalendarLink(event)} target="_blank" rel="noreferrer" onClick={onClose}>
          <CalendarPlus size={18} /> Google Calendar
        </a>
        <Button block icon={<Download size={18} />} onClick={downloadIcs}>
          Other calendar (.ics)
        </Button>
      </div>
    </Sheet>
  );
}
