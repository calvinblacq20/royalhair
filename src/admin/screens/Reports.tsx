import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useAppData } from "../../data/store";
import { money, plural } from "../../lib/format";
import { earningsByStaff } from "../../lib/metrics";
import { bucketsFor, compactMoney, groupShares, kpi, leadSources, metricSeries, paymentsByMethod, periodLabel, periodRange, serviceShares, topClients, type MetricId } from "../../lib/trends";
import { useBranchScope } from "../branch";
import { LegendLine, LineChart, RankTable, SegmentedBar, Sparkline } from "../charts";
import { CardHead, DeltaPill, PeriodSelect, formatMetric } from "../controls";
import { useFirstVisit, useNow } from "../hooks";
import { AdminPage, BranchSwitch } from "../Shell";
import { METHOD_COLOR } from "./Payments";
import { INK, TrendCard, usePeriod, useScopedVisits } from "./Today";

const REPORT_METRICS: MetricId[] = ["visits", "newClients", "avgSpend", "noShows"];
const SPARK_METRICS: MetricId[] = ["cash", "visits", "newClients", "noShows"];
const PLUM = "#c0adff";

export function Reports() {
  const data = useAppData();
  const visits = useScopedVisits();
  const scope = useBranchScope();
  const now = useNow();
  const [period, setPeriod] = usePeriod();
  const first = useFirstVisit("reports");
  const range = periodRange(period, now);
  const buckets = bucketsFor(period, range);
  const sparks = useMemo(() => SPARK_METRICS.map((m) => kpi(m, visits, period, now)), [visits, period, now]);
  const done = useMemo(() => metricSeries("visits", visits, buckets, now), [visits, buckets, now]);
  const noShows = useMemo(() => metricSeries("noShows", visits, buckets, now), [visits, buckets, now]);
  const methods = paymentsByMethod(visits, range);
  const clients = topClients(visits, data.customers, range).slice(0, 6);
  const groups = groupShares(visits, range);
  const sources = leadSources(visits, data.customers, range);
  const services = serviceShares(visits, range).slice(0, 8);
  const staff = earningsByStaff(visits, data.staff.filter((s) => scope === "all" || s.branchId === scope), range.start, now).filter((e) => e.visits > 0);
  const staffTotal = staff.reduce((s, e) => s + e.revenue, 0) || 1;

  return (
    <AdminPage
      title="Reports"
      status={<>{periodLabel(period)} compared with the period before</>}
      actions={
        <>
          <BranchSwitch />
          <PeriodSelect value={period} onChange={setPeriod} />
        </>
      }
    >
      <div className="adm-stack">
        <TrendCard ids={REPORT_METRICS} period={period} id="reports" />

        <div className="adm-grid adm-report">
          <section className="adm-card" aria-label="Key numbers">
            {sparks.map((k, i) => (
              <div key={k.def.id} className="between" style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--ink-06)" : undefined, alignItems: "flex-end" }}>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="adm-meta">{k.def.label}</span>
                  <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatMetric(k.value, k.def.format, true)}</span>
                  <DeltaPill delta={k.delta} />
                </span>
                <Sparkline values={k.series} label={`${k.def.label} trend`} width={84} height={34} />
              </div>
            ))}
          </section>

          <div className="adm-stack">
            <section className="adm-card" aria-labelledby="flow">
              <CardHead id="flow" title="Visits done and no-shows" action={<LegendLine items={[{ label: "Done", color: INK }, { label: "No-shows", color: PLUM }]} />} />
              <div className="adm-card-body">
                <LineChart
                  animate={first}
                  dataKey={period}
                  height={220}
                  labels={buckets.map((b) => b.label)}
                  format={(n) => plural(n, "visit")}
                  axisFormat={String}
                  ariaLabel={`Visits done and no-shows, ${periodLabel(period).toLowerCase()}: ${done.reduce<number>((s, v) => s + (v ?? 0), 0)} done, ${noShows.reduce<number>((s, v) => s + (v ?? 0), 0)} no-shows.`}
                  emptyText="No visits in this period"
                  series={[
                    { label: "Done", values: done, color: INK },
                    { label: "No-shows", values: noShows, color: PLUM },
                  ]}
                />
              </div>
            </section>
            <section className="adm-card" aria-labelledby="methods">
              <CardHead id="methods" title="Payments by method" action={<Link className="adm-link" to={`/admin/payments${period === "30d" ? "" : `?period=${period}`}`}>All payments</Link>} />
              <div className="adm-card-body">
                <SegmentedBar
                  animate={first}
                  format={money}
                  ariaLabel={`Payments by method: ${methods.map((m) => `${m.label} ${Math.round(m.share * 100)}%`).join(", ")}`}
                  parts={methods.map((m) => ({ key: m.key, label: m.label, value: m.value, share: m.share, color: METHOD_COLOR[m.key] }))}
                />
              </div>
            </section>
          </div>

          <div className="adm-stack adm-report-side">
            <section className="adm-card" aria-labelledby="clients">
              <CardHead id="clients" title="Top clients" />
              {clients.length ? (
                <div className="adm-rows" style={{ paddingBlock: "4px 8px" }}>
                  {clients.map((c) => (
                    <Link key={c.customer.id} to={`/admin/clients/${c.customer.id}`} className="adm-row" style={{ minHeight: 52 }}>
                      <span className="grow stack">
                        <span className="truncate">{c.customer.name}</span>
                        <span className="t-cap muted">{plural(c.visits, "visit")}</span>
                      </span>
                      <span className="tabular" style={{ fontWeight: 500 }}>
                        {compactMoney(c.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="adm-card-body muted">No payments in this period.</p>
              )}
            </section>
            <section className="adm-card" aria-labelledby="groups">
              <CardHead id="groups" title="Barbershop, hair, nails, spa" />
              <div className="adm-card-body">
                <RankTable nameLabel="Part of the salon" valueLabel="Services" empty="No finished visits in this period." rows={groups.map((g) => ({ key: g.key, name: g.label, value: g.value, share: g.share }))} />
              </div>
            </section>
          </div>
        </div>

        <div className="adm-grid adm-grid-2">
          <section className="adm-card" aria-labelledby="top-services">
            <CardHead id="top-services" title="Top services" />
            <div className="adm-card-body">
              <RankTable nameLabel="Service" valueLabel="Visits" empty="No finished visits in this period." rows={services.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
            </div>
          </section>
          <section className="adm-card" aria-labelledby="by-staff">
            <CardHead id="by-staff" title="Takings by barber and stylist" />
            <div className="adm-card-body">
              <RankTable nameLabel="Staff" valueLabel="Takings" format={money} empty="No finished visits in this period." rows={staff.map((s) => ({ key: s.staff.id, name: `${s.staff.name} · ${plural(s.visits, "visit")}`, value: s.revenue, share: s.revenue / staffTotal }))} />
            </div>
          </section>
        </div>

        <section className="adm-card" aria-labelledby="lead">
          <CardHead id="lead" title="How clients found the salon" />
          <div className="adm-card-body">
            <RankTable nameLabel="Source" valueLabel="Clients" empty="No visits in this period." rows={sources.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
          </div>
        </section>
      </div>
    </AdminPage>
  );
}
