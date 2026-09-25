import { Armchair, CalendarClock, Clock, Coffee, Plus, UserX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../../components/Bits";
import { Cta } from "../../components/Button";
import { branchById, BRANCHES } from "../../data/business";
import { serviceById } from "../../data/catalog";
import { useAppData } from "../../data/store";
import type { Visit } from "../../data/types";
import { openingOn } from "../../lib/booking";
import { fmtDayLong, fmtTime, money, parseLocal, plural } from "../../lib/format";
import { chairUtilisation, dayBoard, rebookDueList, takingsOnDay, type DayBoard } from "../../lib/metrics";
import { badgeFor } from "../../lib/visits";
import { useBranchScope } from "../branch";
import { useNow } from "../hooks";
import { VisitSheet } from "../sheets";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

const EMPTY: DayBoard = { now: [], next: [], waiting: [], done: [], missed: [], takings: 0, booked: 0 };

function merge(a: DayBoard, b: DayBoard): DayBoard {
  return {
    now: [...a.now, ...b.now],
    next: [...a.next, ...b.next].sort((x, y) => x.start.localeCompare(y.start)),
    waiting: [...a.waiting, ...b.waiting],
    done: [...a.done, ...b.done],
    missed: [...a.missed, ...b.missed],
    takings: a.takings + b.takings,
    booked: a.booked + b.booked,
  };
}

/** The front desk's whole day on one screen: who's in the chair, who's waiting, who's next. */
export function Today() {
  const data = useAppData();
  const navigate = useNavigate();
  const now = useNow();
  const scope = useBranchScope();
  const [openId, setOpenId] = useState<string | null>(null);

  const branches = scope === "all" ? BRANCHES.filter((b) => b.active) : BRANCHES.filter((b) => b.id === scope);
  const board = useMemo(
    () => branches.reduce((acc, branch) => merge(acc, dayBoard(data.visits, now, branch.id, now)), EMPTY),
    [branches, data.visits, now],
  );
  const rebook = rebookDueList(data.visits, now).length;
  const busiest = branches
    .map((branch) => ({ branch, use: chairUtilisation(data.visits, branch, data.staff, now) }))
    .sort((a, b) => b.use - a.use);
  const single = branches.length === 1 ? branches[0] : undefined;
  const hours = single ? openingOn(single, now) : null;

  return (
    <AdminPage
      title="Today"
      status={
        <>
          {fmtDayLong(now)}
          {single && (hours ? ` · open ${fmtTime(hours.start)}–${fmtTime(hours.end)}` : " · closed today")}
        </>
      }
      actions={
        <>
          <BranchSwitch />
          <Cta onClick={() => navigate("/admin/walk-in")}>Add walk-in</Cta>
        </>
      }
    >
      <div className="adm-stack">
        <div className="today-stats">
          <Stat label="Taken today" value={money(scope === "all" ? takingsOnDay(data.visits, now) : board.takings)} />
          <Stat label="In the chair" value={String(board.now.length)} />
          <Stat label="Waiting" value={String(board.waiting.length)} tone={board.waiting.length ? "gold" : undefined} />
          <Stat label="Still to come" value={String(board.next.length)} />
        </div>

        {board.missed.length > 0 && (
          <Column
            title="Past their start time"
            icon={<UserX size={18} strokeWidth={1.8} />}
            visits={board.missed}
            onOpen={setOpenId}
            now={now}
            hint="Call them, or mark a no-show to free the chair."
          />
        )}

        <div className="today-columns">
          <Column title="In the chair" icon={<Armchair size={18} strokeWidth={1.8} />} visits={board.now} onOpen={setOpenId} now={now} empty="Nobody seated right now." badges={false} />
          <Column title="Waiting to be seated" icon={<Coffee size={18} strokeWidth={1.8} />} visits={board.waiting} onOpen={setOpenId} now={now} empty="No one waiting." badges={false} />
          <Column title="Next up" icon={<Clock size={18} strokeWidth={1.8} />} visits={board.next} onOpen={setOpenId} now={now} empty="Nothing else booked today." />
        </div>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">Chairs in use today</h2>
            <Link className="adm-link" to="/admin/diary">
              Open diary
            </Link>
          </div>
          <div className="adm-card-body stack gap-12">
            {busiest.map(({ branch, use }) => (
              <div key={branch.id} className="stack gap-4">
                <div className="kv">
                  <span>{branch.name}</span>
                  <span className="tabular">{Math.round(use * 100)}%</span>
                </div>
                <span className="use-track" aria-hidden="true">
                  <i style={{ width: `${Math.round(use * 100)}%` }} />
                </span>
              </div>
            ))}
            <p className="adm-meta">Booked minutes against the chair-minutes the branch had staffed today.</p>
          </div>
        </section>

        {rebook > 0 && (
          <Link to="/admin/clients?view=rebook" className="adm-card rebook-card">
            <div className="adm-card-body inline gap-12">
              <span className="row-icon" aria-hidden="true">
                <CalendarClock size={18} strokeWidth={1.8} />
              </span>
              <span className="grow stack gap-4">
                <span className="t-title">{plural(rebook, "regular")} due back soon</span>
                <span className="muted t-cap">Their usual service is due and nothing is booked. One WhatsApp each fills the diary.</span>
              </span>
            </div>
          </Link>
        )}

        {board.now.length + board.waiting.length + board.next.length + board.done.length + board.missed.length === 0 && (
          <EmptyState
            icon={<Plus size={24} />}
            title="A quiet day so far"
            body="Walk-ins go straight into the diary. Add the first one and it appears here."
            action={<Cta onClick={() => navigate("/admin/walk-in")}>Add walk-in</Cta>}
          />
        )}
      </div>

      <VisitSheet visitId={openId} open={openId !== null} onClose={() => setOpenId(null)} />
    </AdminPage>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className={`adm-card stat-card ${tone ? `is-${tone}` : ""}`}>
      <span className="adm-meta">{label}</span>
      <span className="stat-value tabular">{value}</span>
    </div>
  );
}

function Column({
  title,
  icon,
  visits,
  onOpen,
  now,
  empty,
  hint,
  badges = true,
}: {
  title: string;
  icon: ReactNode;
  visits: Visit[];
  onOpen: (id: string) => void;
  now: Date;
  empty?: string;
  hint?: string;
  /** Off where the column title already says the status. */
  badges?: boolean;
}) {
  const data = useAppData();
  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <h2 className="t-title inline gap-8">
          {icon}
          {title}
        </h2>
        <span className="chip-count">{visits.length}</span>
      </div>
      {hint && <p className="adm-meta" style={{ padding: "0 20px" }}>{hint}</p>}
      {visits.length === 0 ? (
        <p className="muted" style={{ padding: "8px 20px 20px" }}>
          {empty}
        </p>
      ) : (
        <div className="adm-rows">
          {visits.map((visit) => {
            const customer = data.customers.find((c) => c.id === visit.customerId);
            const staff = data.staff.find((s) => s.id === visit.staffId);
            const badge = badgeFor(visit, now);
            return (
              <button key={visit.id} className="adm-row" onClick={() => onOpen(visit.id)}>
                <span className="adm-row-time tabular">{fmtTime(parseLocal(visit.start))}</span>
                <span className="grow stack gap-4" style={{ minWidth: 0 }}>
                  <span className="t-title truncate">
                    {customer?.name ?? "Client"}
                    {customer?.hair?.allergies && <span className="allergy-dot" title="Has an allergy on record" aria-label="Has an allergy on record" />}
                  </span>
                  <span className="muted t-cap truncate">
                    {visit.items.map((i) => serviceById(i.serviceId)?.name).join(", ")} · {staff?.name}
                    {branchById(visit.branchId) && ` · ${branchById(visit.branchId)!.name}`}
                  </span>
                </span>
                {badges && <Badge tone={badge.tone}>{badge.label}</Badge>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
