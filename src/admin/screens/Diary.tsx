import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cta } from "../../components/Button";
import { branchById } from "../../data/business";
import { ROLE_LABEL, serviceById } from "../../data/catalog";
import { useAppData } from "../../data/store";
import { holdsSlot, openingOn, staffWorksOn } from "../../lib/booking";
import { addDays, dayKey, fmtDayLong, fmtTime, localIso, parseLocal, startOfDay } from "../../lib/format";
import { badgeFor } from "../../lib/visits";
import { concreteBranchId, useBranchScope } from "../branch";
import { useNow } from "../hooks";
import { VisitSheet } from "../sheets";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

/** 60 minutes is 72px tall: a 30-minute shape-up is still big enough to tap. */
const PX_PER_MIN = 1.2;
const STEP = 30;

/**
 * One day, one column per staff member. Read down a column to see a stylist's day; read across
 * a row to see who is free at 14:00. Tapping an empty half hour starts a walk-in in that slot.
 */
export function Diary() {
  const data = useAppData();
  const navigate = useNavigate();
  const now = useNow();
  const scope = useBranchScope();
  const branchId = concreteBranchId(scope);
  const branch = branchById(branchId)!;
  const [day, setDay] = useState(() => startOfDay(now));
  const [openId, setOpenId] = useState<string | null>(null);

  const opening = openingOn(branch, day);
  const staff = data.staff.filter((s) => s.branchId === branchId && staffWorksOn(s, day));
  const visits = useMemo(
    () => data.visits.filter((v) => v.branchId === branchId && v.start.startsWith(dayKey(day)) && holdsSlot(v)),
    [data.visits, branchId, day],
  );
  const requests = visits.filter((v) => v.status === "requested").length;

  const rows: Date[] = [];
  if (opening) {
    for (let t = opening.start.getTime(); t < opening.end.getTime(); t += STEP * 60_000) rows.push(new Date(t));
  }
  const height = opening ? ((opening.end.getTime() - opening.start.getTime()) / 60_000) * PX_PER_MIN : 0;
  const nowOffset = opening && dayKey(now) === dayKey(day) && now >= opening.start && now <= opening.end
    ? ((now.getTime() - opening.start.getTime()) / 60_000) * PX_PER_MIN
    : null;

  return (
    <AdminPage
      title="Diary"
      status={
        <>
          {fmtDayLong(day)} · {branch.name}
          {requests > 0 && ` · ${requests} to confirm`}
        </>
      }
      actions={
        <>
          <BranchSwitch allowAll={false} />
          <Cta onClick={() => navigate(`/admin/walk-in?branch=${branchId}`)}>Add walk-in</Cta>
        </>
      }
    >
      <div className="diary-nav">
        <button className="icon-btn" onClick={() => setDay((d) => addDays(d, -1))} aria-label="Previous day">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <button className="chip" onClick={() => setDay(startOfDay(now))} disabled={dayKey(day) === dayKey(now)}>
          Today
        </button>
        <button className="icon-btn" onClick={() => setDay((d) => addDays(d, 1))} aria-label="Next day">
          <ChevronRight size={20} strokeWidth={1.8} />
        </button>
      </div>

      {!opening ? (
        <EmptyState icon={<Plus size={24} />} title={`${branch.name} is closed`} body="Pick another day, or change the opening hours in Settings." />
      ) : staff.length === 0 ? (
        <EmptyState icon={<Plus size={24} />} title="Nobody is rostered" body="No staff member works at this branch on this day. Check the Staff screen." />
      ) : (
        <div className="diary-scroll" role="region" aria-label={`Diary for ${branch.name}`} tabIndex={0}>
          <div className="diary" style={{ gridTemplateColumns: `56px repeat(${staff.length}, minmax(148px, 1fr))` }}>
            <div className="diary-corner" />
            {staff.map((member) => (
              <div key={member.id} className="diary-head">
                <span className="t-title truncate">{member.name.split(" ")[0]}</span>
                <span className="adm-meta truncate">{ROLE_LABEL[member.role]}</span>
              </div>
            ))}

            <div className="diary-times" style={{ height }}>
              {rows.map((row) => (
                <span key={row.getTime()} style={{ top: ((row.getTime() - opening.start.getTime()) / 60_000) * PX_PER_MIN }}>
                  {row.getMinutes() === 0 ? fmtTime(row) : ""}
                </span>
              ))}
            </div>

            {staff.map((member) => (
              <div key={member.id} className="diary-col" style={{ height }}>
                {rows.map((row) => {
                  const top = ((row.getTime() - opening.start.getTime()) / 60_000) * PX_PER_MIN;
                  const past = row < now;
                  return (
                    <button
                      key={row.getTime()}
                      className="diary-slot"
                      style={{ top, height: STEP * PX_PER_MIN }}
                      disabled={past}
                      aria-label={`Add a walk-in with ${member.name} at ${fmtTime(row)}`}
                      onClick={() => navigate(`/admin/walk-in?branch=${branchId}&staff=${member.id}&start=${localIso(row)}`)}
                    />
                  );
                })}
                {visits
                  .filter((v) => v.staffId === member.id)
                  .map((visit) => {
                    const start = parseLocal(visit.start);
                    const top = ((start.getTime() - opening.start.getTime()) / 60_000) * PX_PER_MIN;
                    const customer = data.customers.find((c) => c.id === visit.customerId);
                    const badge = badgeFor(visit, now);
                    return (
                      <button
                        key={visit.id}
                        className={`diary-visit is-${badge.tone}`}
                        style={{ top, height: Math.max(visit.minutes * PX_PER_MIN - 3, 26) }}
                        onClick={() => setOpenId(visit.id)}
                      >
                        <span className="diary-visit-name truncate">{customer?.name ?? "Client"}</span>
                        <span className="diary-visit-meta truncate">
                          {fmtTime(start)} · {visit.items.map((i) => serviceById(i.serviceId)?.name).join(", ")}
                        </span>
                      </button>
                    );
                  })}
                {nowOffset !== null && <span className="diary-now" style={{ top: nowOffset }} aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <VisitSheet visitId={openId} open={openId !== null} onClose={() => setOpenId(null)} />
    </AdminPage>
  );
}
