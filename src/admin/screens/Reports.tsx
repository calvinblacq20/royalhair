import { useMemo, useState } from "react";
import { BRANCHES } from "../../data/business";
import { useAppData } from "../../data/store";
import { addDays, money, startOfDay } from "../../lib/format";
import { earningsByStaff, statsBetween, topServices } from "../../lib/metrics";
import { BarChart, RankTable } from "../charts";
import { useBranchScope } from "../branch";
import { useNow } from "../hooks";
import { AdminPage, BranchSwitch } from "../Shell";

const PERIODS = [
  { id: 7, label: "7 days" },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
] as const;

export function Reports() {
  const data = useAppData();
  const now = useNow();
  const scope = useBranchScope();
  const [days, setDays] = useState<(typeof PERIODS)[number]["id"]>(30);

  const from = startOfDay(addDays(now, -(days - 1)));
  const branchId = scope === "all" ? undefined : scope;
  const stats = statsBetween(data.visits, from, now, branchId);
  const inRange = useMemo(
    () => data.visits.filter((v) => v.start >= from.toISOString().slice(0, 10) && (!branchId || v.branchId === branchId)),
    [data.visits, from, branchId],
  );
  const services = topServices(inRange, branchId);
  const staff = earningsByStaff(data.visits, data.staff.filter((s) => !branchId || s.branchId === branchId), from, now).filter((e) => e.visits > 0);
  const byBranch = BRANCHES.filter((b) => b.active).map((b) => {
    const value = statsBetween(data.visits, from, now, b.id).revenue;
    return { label: b.name, value, title: `${b.name}: ${money(value)}` };
  });
  const noShowRate = stats.visits + stats.noShows ? Math.round((stats.noShows / (stats.visits + stats.noShows)) * 100) : 0;
  const topTotal = services.reduce((sum, s) => sum + s.revenue, 0) || 1;
  const staffTotal = staff.reduce((sum, s) => sum + s.revenue, 0) || 1;

  return (
    <AdminPage
      title="Reports"
      status={`Last ${days} days · finished visits only`}
      actions={
        <>
          <BranchSwitch />
          <div className="segmented" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.id} className={days === p.id ? "is-active" : ""} onClick={() => setDays(p.id)} aria-pressed={days === p.id}>
                {p.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      <div className="adm-stack">
        <div className="today-stats">
          <div className="adm-card stat-card">
            <span className="adm-meta">Revenue</span>
            <span className="stat-value tabular">{money(stats.revenue)}</span>
          </div>
          <div className="adm-card stat-card">
            <span className="adm-meta">Visits finished</span>
            <span className="stat-value tabular">{stats.visits}</span>
          </div>
          <div className="adm-card stat-card">
            <span className="adm-meta">Average spend</span>
            <span className="stat-value tabular">{money(stats.averageSpend)}</span>
          </div>
          <div className={`adm-card stat-card ${noShowRate >= 10 ? "is-gold" : ""}`}>
            <span className="adm-meta">No-show rate</span>
            <span className="stat-value tabular">{noShowRate}%</span>
          </div>
        </div>

        {scope === "all" && (
          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="t-title">Revenue by branch</h2>
            </div>
            <div className="adm-card-body">
              <BarChart bars={byBranch} ariaLabel="Revenue by branch" format={money} height={170} />
            </div>
          </section>
        )}

        <div className="adm-grid adm-grid-2">
          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="t-title">What earns</h2>
            </div>
            <div className="adm-card-body">
              <RankTable
                nameLabel="Service"
                valueLabel="Revenue"
                format={money}
                empty="No finished visits in this period."
                rows={services.map((s) => ({ key: s.serviceId, name: `${s.name} · ${s.count}`, value: s.revenue, share: s.revenue / topTotal }))}
              />
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="t-title">By staff member</h2>
            </div>
            <div className="adm-card-body">
              <RankTable
                nameLabel="Staff"
                valueLabel="Takings"
                format={money}
                empty="No finished visits in this period."
                rows={staff.map((s) => ({ key: s.staff.id, name: `${s.staff.name} · ${s.visits}`, value: s.revenue, share: s.revenue / staffTotal }))}
              />
            </div>
          </section>
        </div>

        <p className="adm-meta">
          {stats.newClients} different clients booked in this period. No-shows count against the client's record and release the chair.
        </p>
      </div>
    </AdminPage>
  );
}
