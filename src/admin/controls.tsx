import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { Cta } from "../components/Button";
import { CountUp } from "../components/Scroll";
import { money } from "../lib/format";
import { compactMoney, formatPercentChange, PERIODS, type Delta, type Kpi, type MetricFormat, type PeriodId } from "../lib/trends";
import { spring } from "../motion";
import { Dropdown } from "./Dropdown";

export function formatMetric(value: number | null, format: MetricFormat, compact = false): string {
  if (value === null) return "–";
  if (format === "money") return compact ? compactMoney(value) : money(value);
  if (format === "percent") return `${value}%`;
  return value.toLocaleString("en-GB");
}

/** Arrow shows the direction; the fill shows whether that's good news (pink), needs attention (gold) or neither. */
export function DeltaPill({ delta, previousLabel = "previous period" }: { delta: Delta; previousLabel?: string }) {
  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus;
  const text = formatPercentChange(delta.change);
  const spoken = delta.change === null ? "new this period" : delta.direction === "flat" ? `no change on the ${previousLabel}` : `${delta.direction} ${text} on the ${previousLabel}`;
  return (
    <span className={`delta is-${delta.tone}`} aria-label={spoken} title={spoken}>
      <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
      {text}
    </span>
  );
}

export function KpiTabs({ kpis, active, onSelect, animate, id }: { kpis: Kpi[]; active: string; onSelect: (id: string) => void; animate: boolean; id: string }) {
  return (
    <div className="kpi-tabs" role="tablist" aria-label="Choose a number to chart">
      {kpis.map((k) => {
        const isActive = k.def.id === active;
        return (
          <button key={k.def.id} role="tab" aria-selected={isActive} aria-controls={`${id}-panel`} className={`kpi-tab ${isActive ? "is-active" : ""}`} onClick={() => onSelect(k.def.id)}>
            {isActive && <motion.span layoutId={`${id}-kpi-hl`} className="kpi-tab-hl" transition={spring.press} />}
            <span className="kpi-label">{k.def.label}</span>
            <span className="kpi-value">
              {animate && k.value !== null && k.def.format !== "percent" ? (
                <CountUp to={k.value} prefix={k.def.format === "money" ? "GH₵ " : ""} />
              ) : (
                formatMetric(k.value, k.def.format)
              )}
            </span>
            <DeltaPill delta={k.delta} />
          </button>
        );
      })}
    </div>
  );
}

export function PeriodSelect({ value, onChange, soft, label = "Period" }: { value: PeriodId; onChange: (p: PeriodId) => void; soft?: boolean; label?: string }) {
  return <Dropdown value={value} onChange={onChange} label={label} variant={soft ? "soft" : "pill"} align="end" options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />;
}

export function CheckRow({ checked, onChange, label, count }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; count?: number }) {
  return (
    <label className="check-row">
      <input type="checkbox" className="cbx" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
      {count !== undefined && <span className="count">{count}</span>}
    </label>
  );
}

export function RadioRow({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: ReactNode }) {
  return (
    <label className="check-row">
      <input type="radio" className="rdo" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

/** Two-thumb range for money filters. Arrow keys move each thumb by one step. */
export function RangeSlider({ min, max, step, low, high, onChange, format, label }: { min: number; max: number; step: number; low: number; high: number; onChange: (low: number, high: number) => void; format: (n: number) => string; label: string }) {
  const id = useId();
  const span = max - min || 1;
  const pct = (v: number) => ((v - min) / span) * 100;
  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <div className="range">
        <span className="range-track" />
        <span className="range-fill" style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }} />
        <input type="range" min={min} max={max} step={step} value={low} aria-label={`${label}: at least`} aria-valuetext={format(low)} onChange={(e) => onChange(Math.min(Number(e.target.value), high - step), high)} />
        <input type="range" min={min} max={max} step={step} value={high} aria-label={`${label}: at most`} aria-valuetext={format(high)} onChange={(e) => onChange(low, Math.max(Number(e.target.value), low + step))} />
      </div>
      <div className="range-values">
        <span>{format(low)}</span>
        <span>{high >= max ? `${format(max)}+` : format(high)}</span>
      </div>
    </div>
  );
}

/** The one urgent batch job on a page, drawn as a dark alert card. Hidden when there's nothing to do. */
export function ActionCard({ title, body, cta, onClick }: { title: string; body: string; cta: string; onClick: () => void }) {
  return (
    <section className="act-card" aria-label={title}>
      <p className="t-title">{title}</p>
      <p>{body}</p>
      <Cta tone="magenta" onClick={onClick}>
        {cta}
      </Cta>
    </section>
  );
}

export function ActionBanner({ title, body, cta, onClick }: { title: string; body: string; cta: string; onClick: () => void }) {
  return (
    <section className="act-banner" aria-label={title}>
      <div className="grow stack" style={{ gap: 2 }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <p>{body}</p>
      </div>
      <button className="btn btn-magenta btn-sm" onClick={onClick}>
        {cta}
      </button>
    </section>
  );
}

export function CardHead({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="adm-card-head">
      <h2 id={id}>{title}</h2>
      {action}
    </div>
  );
}
