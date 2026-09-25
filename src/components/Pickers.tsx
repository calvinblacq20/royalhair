import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { addDays, dayKey, monthLong, monthShort, startOfDay, weekdayShort } from "../lib/format";
import { spring } from "../motion";

export interface DayState {
  disabled: boolean;
  flag?: string;
}

interface DateStripProps {
  days: Date[];
  selected?: string;
  onSelect: (key: string) => void;
  stateFor: (day: Date) => DayState;
  label: string;
}

export function DateStrip({ days, selected, onSelect, stateFor, label }: DateStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    ref.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <div ref={ref} className="date-strip" role="listbox" aria-label={label}>
      {days.map((day) => {
        const key = dayKey(day);
        const state = stateFor(day);
        const isSelected = key === selected;
        return (
          <motion.button
            key={key}
            data-day={key}
            role="option"
            aria-selected={isSelected}
            className={`date-cell ${isSelected ? "is-selected" : ""}`}
            disabled={state.disabled}
            onClick={() => onSelect(key)}
            whileTap={{ scale: 0.94 }}
            transition={spring.press}
          >
            <span>{weekdayShort(day)}</span>
            <b>{day.getDate()}</b>
            {state.flag ? <span className="flag">{state.flag}</span> : <small>{monthShort(day)}</small>}
          </motion.button>
        );
      })}
    </div>
  );
}

interface MonthCalendarProps {
  selected?: string;
  min: Date;
  max: Date;
  isDisabled: (day: Date) => boolean;
  onSelect: (key: string) => void;
}

export function MonthCalendar({ selected, min, max, isDisabled, onSelect }: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const base = selected ? new Date(`${selected}T00:00`) : min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i))];
  const canPrev = first > startOfDay(min);
  const canNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) <= max;
  const todayKey = dayKey(new Date());

  return (
    <div className="stack gap-12">
      <div className="between">
        <button className="icon-btn is-plain" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} disabled={!canPrev} aria-label="Previous month" style={{ opacity: canPrev ? 1 : 0.3 }}>
          <ChevronLeft size={20} />
        </button>
        <p className="t-title">
          {monthLong(cursor)} {cursor.getFullYear()}
        </p>
        <button className="icon-btn is-plain" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} disabled={!canNext} aria-label="Next month" style={{ opacity: canNext ? 1 : 0.3 }}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="t-cap subtle" style={{ paddingBottom: 6 }}>
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const key = dayKey(day);
          const disabled = day < startOfDay(min) || day > max || isDisabled(day);
          const isSelected = key === selected;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={day.toDateString()}
              style={{
                height: 42,
                borderRadius: 999,
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                background: isSelected ? "var(--ink)" : "transparent",
                color: isSelected ? "#fff" : disabled ? "var(--ink-25)" : "var(--ink)",
                fontWeight: key === todayKey && !isSelected ? 600 : undefined,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
