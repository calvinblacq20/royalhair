import { CalendarDays, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Cta } from "../../components/Button";
import { DateStrip } from "../../components/Pickers";
import { branchById } from "../../data/business";
import { ROLE_LABEL, serviceById } from "../../data/catalog";
import { useAppData } from "../../data/store";
import { holdsSlot, openingOn, staffWorksOn } from "../../lib/booking";
import { addDays, dayKey, daysBetween, fmtDayLong, fmtTime, localIso, parseLocal, plural, startOfDay } from "../../lib/format";
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
  const [params, setParams] = useSearchParams();
  const today = startOfDay(now);
  const raw = params.get("day");
  const linked = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? parseLocal(raw) : null;
  // A link more than a year out is treated as a typo rather than drawing a thousand-day strip.
  const day = linked && Math.abs(daysBetween(today, linked)) <= 366 ? linked : today;
  // Three days back so the desk can close out recent visits, two months ahead so every online
  // booking is reachable, and always the day in the link.
  const days = useMemo(() => {
    const from = new Date(Math.min(addDays(today, -3).getTime(), day.getTime()));
    const to = new Date(Math.max(addDays(today, 60).getTime(), day.getTime()));
    return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  }, [today.getTime(), day.getTime()]);
  const [openId, setOpenId] = useState<string | null>(null);
  const setDay = (key: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === dayKey(now)) next.delete("day");
        else next.set("day", key);
        return next;
      },
      { replace: true },
    );
  const counts = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const v of data.visits) if (v.branchId === branchId && holdsSlot(v)) perDay.set(v.start.slice(0, 10), (perDay.get(v.start.slice(0, 10)) ?? 0) + 1);
    return perDay;
  }, [data.visits, branchId]);

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
        <DateStrip
          label="Choose a day"
          days={days}
          selected={dayKey(day)}
          onSelect={setDay}
          stateFor={(d) => {
            const n = counts.get(dayKey(d)) ?? 0;
            return { disabled: false, flag: !openingOn(branch, d) ? "Closed" : n ? plural(n, "visit") : undefined };
          }}
        />
      </div>

      {!opening ? (
        <EmptyState icon={<CalendarDays size={22} />} title={`${branch.name} is closed this day`} body="Pick another day, or change the opening hours in Settings." />
      ) : staff.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title="Nobody is rostered" body="No staff member works at this branch on this day. Check the Staff screen." />
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
