import { motion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { isCalm, motionMode, spring } from "../motion";

/* Plain SVG charts (docs/admin-ui-guidelines.md §7). Lines in ink and slate; pastels only as labelled fills. */

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

export interface LineSeries {
  label: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
  area?: boolean;
}

interface LineChartProps {
  series: LineSeries[];
  labels: string[];
  /** Full value for tooltips. */
  format: (n: number) => string;
  /** Short value for the axis. */
  axisFormat: (n: number) => string;
  ariaLabel: string;
  height?: number;
  /** Shown instead of lines when there's nothing to draw. */
  emptyText?: string;
  /** Change this to crossfade when the data switches (e.g. another metric). */
  dataKey?: string;
  animate?: boolean;
  /** Tooltip heading per point; defaults to the axis label. */
  tipLabel?: (i: number) => string;
}

export function LineChart({ series, labels, format, axisFormat, ariaLabel, height = 240, emptyText, dataKey = "", animate = true, tipLabel }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  // Calm mode skips the line drawing itself in; the fade (opacity) stays.
  const reduce = isCalm();
  const gradientId = useId();
  const n = labels.length;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const empty = all.length === 0 || all.every((v) => v === 0);
  const rawMax = Math.max(0, ...all);
  const step = niceStep(rawMax / 4 || 1);
  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const left = Math.max(28, ...ticks.map((t) => axisFormat(t).length * 6.6 + 10));
  const right = 8;
  const top = 10;
  const bottom = 28;
  const innerW = Math.max(10, width - left - right);
  const innerH = height - top - bottom;
  const x = (i: number) => left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => top + innerH - (v / max) * innerH;

  const pathFor = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaFor = (values: (number | null)[]) => {
    const pts = values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const))).filter((p): p is readonly [number, number] => p !== null);
    if (pts.length < 2) return "";
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    return `M${first[0]},${top + innerH}L${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}L${last[0]},${top + innerH}Z`;
  };

  const maxLabels = Math.max(2, Math.floor(innerW / 76));
  const labelStep = Math.max(1, Math.ceil(n / maxLabels));

  const indexAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const px = clientX - rect.left - left;
    return Math.min(n - 1, Math.max(0, Math.round((px / innerW) * (n - 1))));
  };
  const onMove = (e: PointerEvent) => !empty && setHover(indexAt(e.clientX));
  const lastIndex = () => {
    const main = series[0]?.values ?? [];
    for (let i = main.length - 1; i >= 0; i--) if (main[i] !== null) return i;
    return n - 1;
  };
  const onKey = (e: KeyboardEvent) => {
    if (empty) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => {
        const from = h ?? lastIndex();
        return Math.min(n - 1, Math.max(0, from + (e.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (e.key === "Escape") setHover(null);
  };

  const tipLeft = hover !== null ? Math.min(Math.max(x(hover), 90), Math.max(90, width - 90)) : 0;

  return (
    <div
      ref={ref}
      className="chart"
      role="img"
      aria-label={ariaLabel}
      tabIndex={empty ? -1 : 0}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      onFocus={() => !empty && setHover(lastIndex())}
      onBlur={() => setHover(null)}
      onKeyDown={onKey}
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#c0adff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#c0adff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} style={{ stroke: "rgba(36,36,38,0.06)" }} />
              <text x={left - 8} y={y(t) + 4} textAnchor="end">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            i % labelStep === (n - 1) % labelStep ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"}>
                {label}
              </text>
            ) : null,
          )}
          {!empty && (
            <motion.g key={dataKey} initial={motionMode() === "off" ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              {series.map((s) =>
                s.area ? <path key={`${s.label}-area`} d={areaFor(s.values)} style={{ fill: `url(#${CSS.escape(gradientId)})` }} /> : null,
              )}
              {series.map((s) =>
                s.dashed ? (
                  <path key={s.label} d={pathFor(s.values)} style={{ fill: "none", stroke: s.color, strokeWidth: 1.5, strokeDasharray: "4 4", strokeLinejoin: "round" }} />
                ) : animate && !reduce ? (
                  <motion.path key={s.label} d={pathFor(s.values)} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={spring.settle} style={{ fill: "none", stroke: s.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }} />
                ) : (
                  <path key={s.label} d={pathFor(s.values)} style={{ fill: "none", stroke: s.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }} />
                ),
              )}
            </motion.g>
          )}
          {hover !== null && !empty && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + innerH} style={{ stroke: "rgba(36,36,38,0.12)" }} />
              {series.map((s) => {
                const v = s.values[hover];
                return v === null || v === undefined ? null : <circle key={s.label} cx={x(hover)} cy={y(v)} r={s.dashed ? 3 : 4} style={{ fill: s.dashed ? "#fff" : s.color, stroke: s.color, strokeWidth: 2 }} />;
              })}
            </g>
          )}
        </svg>
      )}
      {empty && emptyText && <p className="chart-empty">{emptyText}</p>}
      {hover !== null && !empty && (
        <div className="chart-tip" style={{ left: tipLeft, transform: "translate(-50%, -8px)" }}>
          <span className="adm-meta">{tipLabel ? tipLabel(hover) : labels[hover]}</span>
          {series.map((s) => {
            const v = s.values[hover];
            return (
              <span key={s.label} className="chart-tip-row">
                <i className={`swatch ${s.dashed ? "is-dash" : "is-line"}`} style={{ background: s.color }} />
                {s.label}
                <b>{v === null || v === undefined ? "–" : format(v)}</b>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LegendLine({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className={`swatch ${item.dashed ? "is-dash" : "is-line"}`} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export interface Bar {
  label: string;
  value: number;
  /** Highlight (today, hovered) in ink; closed days draw as a stub. */
  emphasis?: boolean;
  closed?: boolean;
  title: string;
}

export function BarChart({ bars, ariaLabel, height = 150, animate = true, format = String }: { bars: Bar[]; ariaLabel: string; height?: number; animate?: boolean; format?: (n: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = isCalm();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const top = 18;
  const bottom = 24;
  const innerH = height - top - bottom;
  const slot = width / Math.max(1, bars.length);
  const barW = Math.min(28, Math.max(6, slot * 0.56));
  const labelEvery = slot < 34 ? 2 : 1;

  return (
    <div ref={ref} className="chart" role="img" aria-label={ariaLabel} style={{ height }} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          <line x1={0} x2={width} y1={top + innerH} y2={top + innerH} style={{ stroke: "rgba(36,36,38,0.06)" }} />
          {bars.map((b, i) => {
            const cx = slot * i + slot / 2;
            const h = b.closed ? 3 : b.value === 0 ? 3 : Math.max(4, (b.value / max) * innerH);
            const r = Math.min(4, barW / 2, h);
            const x0 = cx - barW / 2;
            const y0 = top + innerH - h;
            const d = `M${x0},${top + innerH}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${top + innerH}Z`;
            const color = b.closed || b.value === 0 ? "rgba(36,36,38,0.06)" : b.emphasis || hover === i ? "#242426" : "#58718a";
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect x={slot * i} y={0} width={slot} height={height} fill="transparent" />
                <motion.path
                  d={d}
                  initial={animate && !reduce ? { scaleY: 0 } : false}
                  animate={{ scaleY: 1 }}
                  transition={{ ...spring.small, delay: animate ? i * 0.02 : 0 }}
                  style={{ fill: color, transformOrigin: `${cx}px ${top + innerH}px`, transition: "fill 0.15s" }}
                />
                {b.value > 0 && !b.closed && (
                  <text x={cx} y={y0 - 5} textAnchor="middle" style={{ fontSize: 11, fill: "#242426", fontWeight: 500 }}>
                    {format(b.value)}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle" style={{ fontWeight: b.emphasis ? 600 : 400 }}>
                    {b.label}
                  </text>
                )}
                <title>{b.title}</title>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function Sparkline({ values, width = 72, height = 28, label }: { values: (number | null)[]; width?: number; height?: number; label: string }) {
  const nums = values.filter((v): v is number => v !== null);
  const max = Math.max(...nums, 0);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const n = values.length;
  let d = "";
  let pen = false;
  let last: [number, number] | null = null;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    const px = n <= 1 ? width / 2 : 2 + (i / (n - 1)) * (width - 4);
    const py = 3 + (height - 6) * (1 - (v - min) / span);
    d += `${pen ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
    pen = true;
    last = [px, py];
  });
  const end = last as [number, number] | null;
  return (
    <svg width={width} height={height} role="img" aria-label={label} style={{ flex: "none", overflow: "visible" }}>
      <path d={d} style={{ fill: "none", stroke: "#58718a", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }} />
      {end && <circle cx={end[0]} cy={end[1]} r={2.5} style={{ fill: "#242426" }} />}
    </svg>
  );
}

export interface Part {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
}

/** Makro's segmented bar with legend rows, instead of a pie chart. */
export function SegmentedBar({ parts, format, ariaLabel, animate = true }: { parts: Part[]; format: (n: number) => string; ariaLabel: string; animate?: boolean }) {
  const reduce = isCalm();
  if (!parts.length) return <p className="adm-meta">Nothing in this period.</p>;
  return (
    <div>
      <div className="seg-bar" role="img" aria-label={ariaLabel}>
        {parts.map((p, i) => (
          <motion.span
            key={p.key}
            style={{ background: p.color, flexGrow: p.share, flexBasis: 0 }}
            initial={animate && !reduce ? { scaleX: 0, originX: 0 } : false}
            animate={{ scaleX: 1 }}
            transition={{ ...spring.large, delay: animate ? 0.05 * i : 0 }}
          />
        ))}
      </div>
      <div className="legend-rows">
        {parts.map((p) => (
          <div key={p.key} className="legend-row">
            <i className="swatch" style={{ background: p.color }} />
            <span className="truncate">{p.label}</span>
            <span className="num">{format(p.value)}</span>
            <span className="share">{Math.round(p.share * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankTable({ rows, valueLabel, nameLabel, format = String, empty }: { rows: { key: string; name: ReactNode; value: number; share: number }[]; valueLabel: string; nameLabel: string; format?: (n: number) => string; empty: string }) {
  if (!rows.length) return <p className="adm-meta" style={{ padding: "8px 0" }}>{empty}</p>;
  const top = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <table className="rank">
      <thead>
        <tr>
          <th className="idx" scope="col">
            <span className="sr-only">Rank</span>#
          </th>
          <th scope="col">{nameLabel}</th>
          <th className="num" scope="col">
            {valueLabel}
          </th>
          <th className="num bar" scope="col">
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key}>
            <td className="idx">{i + 1}</td>
            <td className="truncate" style={{ maxWidth: 1 }}>
              {row.name}
            </td>
            <td className="num">{format(row.value)}</td>
            <td className="bar">
              <span className="inline" style={{ gap: 8, width: "100%", justifyContent: "flex-end" }}>
                <span className="mini-bar" style={{ width: 40 }} aria-hidden="true">
                  <i style={{ width: `${(row.share / top) * 100}%` }} />
                </span>
                <span className="tabular" style={{ minWidth: 30, textAlign: "right" }}>
                  {Math.round(row.share * 100)}%
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
