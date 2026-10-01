import { ArrowRight, CalendarDays, Check, ChevronRight, Table2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Skeleton } from "../../components/Bits";
import { Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { CountUp } from "../../components/Scroll";
import { BRANCHES } from "../../data/business";
import { customerById, desk, useAppData } from "../../data/store";
import type { Visit, VisitStatus } from "../../data/types";
import { openingOn } from "../../lib/booking";
import { dayKey, fmtDayLong, fmtTime, money, parseLocal, plural } from "../../lib/format";
import { rebookDueList } from "../../lib/metrics";
import { openStatus } from "../../lib/schedule";
import { bookedAhead, bucketsFor, compactMoney, isPeriodId, kpi, leadSources, METRICS, periodLabel, periodRange, serviceShares, type MetricId, type PeriodId } from "../../lib/trends";
import { balanceDue } from "../../lib/visits";
import { enter } from "../../motion";
import { useBranchScope } from "../branch";
import { BarChart, LegendLine, LineChart, RankTable } from "../charts";
import { ActionBanner, ActionCard, CardHead, KpiTabs, PeriodSelect, formatMetric } from "../controls";
import { useFirstLoad, useFirstVisit, useNow } from "../hooks";
import { VisitSheet } from "../sheets";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";
import { visitTitle } from "../visitCard";

const TODAY_METRICS: MetricId[] = ["cash", "visits", "noShows", "avgSpend"];
export const INK = "#242426";
export const PREVIOUS = "rgba(28,23,25,0.5)";

/** The day's stages, in the order a client moves through them. */
const FLOOR_STAGES: { status: VisitStatus; label: string }[] = [
  { status: "requested", label: "To confirm" },
  { status: "confirmed", label: "Booked" },
  { status: "arrived", label: "Waiting" },
  { status: "in-chair", label: "In the chair" },
  { status: "done", label: "Done" },
];

export function usePeriod(fallback: PeriodId = "30d"): [PeriodId, (p: PeriodId) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("period");
  const period = isPeriodId(raw) ? raw : fallback;
  const set = (p: PeriodId) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p === fallback) next.delete("period");
        else next.set("period", p);
        return next;
      },
      { replace: true },
    );
  return [period, set];
}

/** Visits for the branch this device is running, or every branch for the owner. */
export function useScopedVisits(): Visit[] {
  const data = useAppData();
  const scope = useBranchScope();
  return useMemo(() => (scope === "all" ? data.visits : data.visits.filter((v) => v.branchId === scope)), [data.visits, scope]);
}

/** A trend card: KPI tabs on top drive one line chart against the previous period. */
export function TrendCard({ ids, period, id, reportLink }: { ids: MetricId[]; period: PeriodId; id: string; reportLink?: boolean }) {
  const visits = useScopedVisits();
  const now = useNow();
  const first = useFirstVisit(`trend:${id}`);
  const [metric, setMetric] = useState<MetricId>(ids[0]!);
  const [asTable, setAsTable] = useState(false);
  const kpis = useMemo(() => ids.map((m) => kpi(m, visits, period, now)), [ids, visits, period, now]);
  const active = kpis.find((k) => k.def.id === metric) ?? kpis[0]!;
  const range = periodRange(period, now);
  const buckets = bucketsFor(period, range);
  const fmt = (n: number) => formatMetric(n, active.def.format);
  const axis = (n: number) => (active.def.format === "money" ? compactMoney(n) : active.def.format === "percent" ? `${n}%` : String(n));
  const tipLabel = (i: number) => {
    const b = buckets[i];
    if (!b) return "";
    return period === "90d" ? `Week of ${b.label}` : period === "year" ? `${b.label} ${b.start.getFullYear()}` : b.label;
  };
  const summary = `${active.def.label}, ${periodLabel(period).toLowerCase()}: ${formatMetric(active.value, active.def.format)}${active.delta.change !== null ? `, ${active.delta.direction} ${Math.round(Math.abs(active.delta.change) * 100)}% on the previous period` : ""}.`;

  return (
    <section className="adm-card kpi-card" aria-label="Trends">
      <KpiTabs kpis={kpis} active={active.def.id} onSelect={(m) => setMetric(m as MetricId)} animate={first} id={id} />
      <div id={`${id}-panel`} role="tabpanel" style={{ padding: "16px 20px 8px" }}>
        {asTable ? (
          <div className="adm-table-wrap" style={{ maxHeight: 280 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">{period === "year" ? "Month" : period === "90d" ? "Week of" : "Day"}</th>
                  <th scope="col" className="num">
                    {periodLabel(period)}
                  </th>
                  <th scope="col" className="num">
                    Previous period
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={b.label + i} style={{ cursor: "default" }}>
                    <td>{tipLabel(i)}</td>
                    <td className="num">{formatMetric(active.series[i] ?? null, active.def.format)}</td>
                    <td className="num">{formatMetric(active.previousSeries[i] ?? null, active.def.format)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LineChart
            dataKey={active.def.id + period}
            animate={first}
            ariaLabel={summary}
            labels={buckets.map((b) => b.label)}
            tipLabel={tipLabel}
            format={fmt}
            axisFormat={axis}
            height={230}
            emptyText={`No ${active.def.label.toLowerCase()} in this period`}
            series={[
              { label: periodLabel(period), values: active.series, color: INK, area: true },
              { label: "Previous period", values: active.previousSeries, color: PREVIOUS, dashed: true },
            ]}
          />
        )}
        <div style={{ marginTop: 10 }}>
          <LegendLine items={[{ label: periodLabel(period), color: INK }, { label: "Previous period", color: PREVIOUS, dashed: true }]} />
        </div>
      </div>
      <div className="adm-card-foot">
        <span className="adm-meta">{METRICS[active.def.id].hint}</span>
        <span className="inline" style={{ gap: 12 }}>
          <button className="adm-link" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            <Table2 size={15} /> {asTable ? "Chart" : "Table"}
          </button>
          {reportLink && (
            <Link to={`/admin/reports${period === "30d" ? "" : `?period=${period}`}`} className="adm-link">
              Reports <ArrowRight size={14} />
            </Link>
          )}
        </span>
      </div>
    </section>
  );
}

export function Today() {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const scope = useBranchScope();
  const visits = useScopedVisits();
  const [period, setPeriod] = usePeriod();
  const [openId, setOpenId] = useState<string | null>(null);
  const loading = useFirstLoad("today");
  const first = useFirstVisit("today");

  const todayKey = dayKey(now);
  const today = useMemo(() => visits.filter((v) => v.start.startsWith(todayKey)).sort((a, b) => a.start.localeCompare(b.start)), [visits, todayKey]);
  const live = today.filter((v) => v.status !== "cancelled");
  const stages = FLOOR_STAGES.map((s) => ({ ...s, count: live.filter((v) => v.status === s.status).length }));
  const inChair = live.filter((v) => v.status === "in-chair").length;
  const waiting = live.filter((v) => v.status === "arrived");
  const stillToCome = live.filter((v) => (v.status === "confirmed" || v.status === "requested") && parseLocal(v.start) >= now).length;
  const late = live.filter((v) => (v.status === "confirmed" || v.status === "requested") && parseLocal(v.start) < now);
  const owingToday = live.reduce((sum, v) => sum + (v.status === "no-show" ? 0 : balanceDue(v)), 0);
  const toConfirm = visits.filter((v) => v.status === "requested" && parseLocal(v.start) >= now).sort((a, b) => a.start.localeCompare(b.start));
  const rebook = rebookDueList(visits, now).length;
  const branch = scope === "all" ? undefined : BRANCHES.find((b) => b.id === scope);
  const open = branch ? openStatus(now, branch.hours) : { open: BRANCHES.some((b) => openStatus(now, b.hours).open), label: "All branches" };
  const days = useMemo(() => bookedAhead(visits, now, 14), [visits, now]);
  const services = useMemo(() => serviceShares(visits, periodRange(period, now)).slice(0, 5), [visits, period, now]);
  const sources = useMemo(() => leadSources(visits, data.customers, periodRange(period, now)), [visits, data.customers, period, now]);

  const urgent =
    late.length > 0
      ? { title: `${plural(late.length, "client")} past their start time`, body: "Call them, or mark a no-show so the chair can take a walk-in.", cta: "See who", to: "/admin/diary" }
      : toConfirm.length > 0
        ? { title: `${plural(toConfirm.length, "online booking")} to confirm`, body: "Clients are waiting for a WhatsApp confirmation of their time.", cta: "Confirm bookings", to: "/admin/diary" }
        : rebook > 0
          ? { title: `${plural(rebook, "regular")} due back`, body: "Their usual service is due and nothing is booked. One message each fills the diary.", cta: "Message them", to: "/admin/clients?view=rebook" }
          : null;

  return (
    <AdminPage
      title="Today"
      status={
        <>
          <span className={`adm-dot ${open.open ? "is-open" : ""}`} aria-hidden="true" />
          {fmtDayLong(now)} · {open.label} · {inChair} in the chair
        </>
      }
      actions={
        <>
          <BranchSwitch />
          <PeriodSelect value={period} onChange={setPeriod} />
          <Cta onClick={() => navigate("/admin/walk-in")}>Add walk-in</Cta>
        </>
      }
    >
      {loading ? (
        <TodaySkeleton />
      ) : (
        <div className="adm-with-rail">
          <div className="adm-stack">
            {urgent && (
              <div className="narrow-only">
                <ActionBanner title={urgent.title} body={urgent.body} cta={urgent.cta} onClick={() => navigate(urgent.to)} />
              </div>
            )}
            <motion.div {...(first ? enter(16) : {})}>
              <TrendCard ids={TODAY_METRICS} period={period} id="today" reportLink />
            </motion.div>

            <motion.div className="adm-grid adm-grid-b" {...(first ? enter(16, 0.08) : {})}>
              <section className="adm-card adm-dark" aria-labelledby="floor-now">
                <div className="adm-card-body" style={{ paddingTop: 18 }}>
                  <p id="floor-now" className="adm-meta">
                    On the floor now
                  </p>
                  <p className="adm-big" style={{ marginTop: 6 }}>
                    {first ? <CountUp to={inChair} /> : inChair}
                  </p>
                  <p className="muted">{inChair === 1 ? "client in the chair" : "clients in the chair"}</p>
                  <div className="stage-strip" style={{ marginTop: 20 }}>
                    {stages.map((s) => {
                      const max = Math.max(1, ...stages.map((x) => x.count));
                      return (
                        <Link key={s.status} to="/admin/diary" className="stage-col" aria-label={`${s.count} ${s.label}`}>
                          <span className="adm-meta truncate">{s.label}</span>
                          <span className="num">{s.count}</span>
                          <span className="stage-track" aria-hidden="true">
                            <motion.i initial={first ? { scaleX: 0 } : false} animate={{ scaleX: 1 }} transition={{ type: "spring", bounce: 0.2, duration: 1, delay: 0.2 }} style={{ width: `${(s.count / max) * 100}%` }} />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="divider" style={{ marginBlock: 18 }} />
                  <Link to="/admin/diary" className="kv">
                    <span>Still to come today</span>
                    <b>{stillToCome}</b>
                  </Link>
                  <Link to="/admin/diary" className="kv">
                    <span>Past their start time</span>
                    <b style={late.length ? { color: "var(--champagne)" } : undefined}>{late.length}</b>
                  </Link>
                  <div className="kv">
                    <span>Balance to collect today</span>
                    <b>{money(owingToday)}</b>
                  </div>
                </div>
              </section>

              <section className="adm-card" aria-labelledby="ahead">
                <CardHead id="ahead" title="Booked in the next 14 days" action={<Link to="/admin/diary" className="adm-link">Diary <ChevronRight size={14} /></Link>} />
                <div className="adm-card-body">
                  <BarChart
                    animate={first}
                    height={190}
                    ariaLabel={`Visits booked each day for the next 14 days: ${days.map((d) => `${d.date.getDate()} ${d.count}`).join(", ")}`}
                    bars={days.map((d, i) => {
                      const closed = branch ? !openingOn(branch, d.date) : false;
                      return {
                        label: i === 0 ? "Today" : String(d.date.getDate()),
                        value: d.count,
                        emphasis: i === 0,
                        closed,
                        title: `${fmtDayLong(d.date)}: ${closed ? "closed" : plural(d.count, "visit")} booked`,
                      };
                    })}
                  />
                  <p className="adm-meta" style={{ marginTop: 8 }}>
                    Online, WhatsApp and phone bookings. Walk-ins arrive on the day.
                  </p>
                </div>
              </section>
            </motion.div>

            <motion.div className="adm-grid adm-grid-2" {...(first ? enter(16, 0.14) : {})}>
              <section className="adm-card" aria-labelledby="visits-today">
                <CardHead id="visits-today" title="Today's visits" action={<Link to="/admin/diary" className="adm-link">Diary <ChevronRight size={14} /></Link>} />
                {today.length ? (
                  <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                    {today.map((v) => (
                      <VisitRow key={v.id} visit={v} now={now} onOpen={() => setOpenId(v.id)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<CalendarDays size={22} />} title="No visits today" body="Bookings and walk-ins for today show here." />
                )}
              </section>

              <section className="adm-card" aria-labelledby="sources">
                <CardHead id="sources" title="Where clients came from" action={<span className="adm-meta">{periodLabel(period)}</span>} />
                <div className="adm-card-body">
                  <RankTable nameLabel="Source" valueLabel="Clients" empty="No visits in this period." rows={sources.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
                </div>
              </section>
            </motion.div>

            <motion.section className="adm-card" aria-labelledby="top-services" {...(first ? enter(16, 0.2) : {})}>
              <CardHead id="top-services" title="Top services" action={<span className="adm-meta">{periodLabel(period)}</span>} />
              <div className="adm-card-body">
                <RankTable nameLabel="Service" valueLabel="Visits" empty="No finished visits in this period." rows={services.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
              </div>
            </motion.section>
          </div>

          <aside className="adm-rail" aria-label="Needs attention">
            {urgent && (
              <div className="wide-only">
                <ActionCard title={urgent.title} body={urgent.body} cta={urgent.cta} onClick={() => navigate(urgent.to)} />
              </div>
            )}
            <section className="adm-card" aria-labelledby="waiting">
              <CardHead id="waiting" title="Waiting to be seated" action={<span className="chip-count">{waiting.length}</span>} />
              {waiting.length ? (
                <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                  {waiting.map((v) => (
                    <button key={v.id} className="adm-row" onClick={() => setOpenId(v.id)}>
                      <span className="grow stack">
                        <span className="truncate" style={{ fontWeight: 500 }}>
                          {customerById(data, v.customerId)?.name ?? v.number}
                        </span>
                        <span className="t-cap muted truncate">
                          {visitTitle(v)} · {data.staff.find((s) => s.id === v.staffId)?.name.split(" ")[0]}
                        </span>
                      </span>
                      <ChevronRight size={18} className="row-chevron" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="adm-card-body muted">Nobody waiting.</p>
              )}
            </section>
            <section className="adm-card" aria-labelledby="to-confirm">
              <CardHead id="to-confirm" title="To confirm" action={<span className="chip-count">{toConfirm.length}</span>} />
              {toConfirm.length ? (
                <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                  {toConfirm.slice(0, 5).map((v) => (
                    <button key={v.id} className="adm-row" onClick={() => setOpenId(v.id)}>
                      <span className="grow stack">
                        <span className="truncate" style={{ fontWeight: 500 }}>
                          {visitTitle(v)}
                        </span>
                        <span className="t-cap muted truncate">
                          {customerById(data, v.customerId)?.name} · {fmtDayLong(parseLocal(v.start)).split(" ").slice(0, 3).join(" ")}, {fmtTime(parseLocal(v.start))}
                        </span>
                      </span>
                      <ChevronRight size={18} className="row-chevron" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="adm-card-body muted">Every booking is confirmed.</p>
              )}
            </section>
          </aside>
        </div>
      )}

      <VisitSheet visitId={openId} open={openId !== null} onClose={() => setOpenId(null)} />
    </AdminPage>
  );
}

function VisitRow({ visit: v, now, onOpen }: { visit: Visit; now: Date; onOpen: () => void }) {
  const data = useAppData();
  const start = parseLocal(v.start);
  const past = start < now;
  const notify = useNotify();
  const customer = customerById(data, v.customerId);
  const staff = data.staff.find((s) => s.id === v.staffId);
  const move = (status: VisitStatus) => {
    const result = desk.moveTo(v.id, status);
    if ("error" in result) notify("Couldn't update the visit", result.error);
  };
  return (
    <div className="adm-row">
      <span className={`adm-row-time ${past ? "is-past" : ""}`}>{fmtTime(start)}</span>
      <span className="grow stack">
        <span className="truncate" style={{ fontWeight: 500 }}>
          {customer ? <Link to={`/admin/clients/${customer.id}`}>{customer.name}</Link> : "Client"}
          {customer?.hair?.allergies && <span className="allergy-dot" title="Allergy on record" aria-label="Allergy on record" />}
        </span>
        <span className="t-cap muted truncate">
          <button className="adm-link" style={{ fontWeight: 400 }} onClick={onOpen}>
            {visitTitle(v)}
          </button>
          {staff ? ` · ${staff.name.split(" ")[0]}` : ""}
        </span>
      </span>
      {v.status === "requested" ? (
        <button className="btn btn-dark btn-sm" onClick={() => move("confirmed")}>
          Confirm
        </button>
      ) : v.status === "confirmed" ? (
        <button className="btn btn-soft btn-sm" onClick={() => move("arrived")}>
          Arrived
        </button>
      ) : v.status === "arrived" ? (
        <button className="btn btn-dark btn-sm" onClick={() => move("in-chair")}>
          Seat
        </button>
      ) : v.status === "in-chair" ? (
        <button className="btn btn-soft btn-sm" onClick={onOpen}>
          Finish
        </button>
      ) : v.status === "done" ? (
        <Badge tone="mist" icon={<Check size={13} />}>
          Done
        </Badge>
      ) : (
        <Badge tone="danger">{v.status === "no-show" ? "No-show" : "Cancelled"}</Badge>
      )}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="adm-with-rail" aria-busy="true">
      <div className="adm-stack">
        <Skeleton h={360} r={8} />
        <div className="adm-grid adm-grid-b">
          <Skeleton h={320} r={8} />
          <Skeleton h={320} r={8} />
        </div>
      </div>
      <div className="adm-rail">
        <Skeleton h={160} r={8} />
        <Skeleton h={260} r={8} />
      </div>
    </div>
  );
}
