import { Pencil, Plus, UserRoundCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { BRANCHES, branchById } from "../../data/business";
import { GROUP_LABEL, GROUPS, ROLE_LABEL } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { ServiceGroup, Staff as StaffMember, StaffRole } from "../../data/types";
import { addDays, money, plural, startOfDay } from "../../lib/format";
import { earningsByStaff } from "../../lib/metrics";
import { useBranchScope } from "../branch";
import { Dropdown } from "../Dropdown";
import { useNow } from "../hooks";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const ROLES = Object.keys(ROLE_LABEL) as StaffRole[];

function WeekDays({ days }: { days: number[] }) {
  return (
    <span className="week-days" role="img" aria-label={`Works ${WEEK.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(", ") || "no days"}`}>
      {WEEK.map((day) => (
        <span key={day} className={days.includes(day) ? "is-on" : ""} aria-hidden="true">
          {DAY_LETTERS[day]}
        </span>
      ))}
    </span>
  );
}

export function Staff() {
  const data = useAppData();
  const now = useNow();
  const scope = useBranchScope();
  const [role, setRole] = useState<StaffRole | "all">("all");
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);

  const since = startOfDay(addDays(now, -29));
  const team = data.staff.filter((s) => scope === "all" || s.branchId === scope);
  const shown = team.filter((s) => role === "all" || s.role === role);
  const rows = earningsByStaff(data.visits, shown, since, now);
  const roles = ROLES.filter((r) => team.some((s) => s.role === r));

  return (
    <AdminPage
      title="Staff"
      status={
        <>
          {plural(team.filter((s) => s.active).length, "person", "people")} working · takings over the last 30 days
        </>
      }
      actions={
        <>
          <BranchSwitch />
          <Cta onClick={() => setEditing("new")}>Add staff</Cta>
        </>
      }
    >
      <div className="chips" role="radiogroup" aria-label="Role" style={{ margin: "0 0 16px" }}>
        {[{ id: "all" as const, label: "Everyone" }, ...roles.map((r) => ({ id: r, label: `${ROLE_LABEL[r]}s` }))].map((r) => (
          <button key={r.id} role="radio" aria-checked={role === r.id} className={`chip ${role === r.id ? "is-active" : ""}`} onClick={() => setRole(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="adm-card">
          <EmptyState icon={<UserRoundCheck size={22} />} title="Nobody here yet" body="Add the barbers, stylists and therapists who take bookings at this branch." action={<Button onClick={() => setEditing("new")}>Add staff</Button>} />
        </div>
      ) : (
        <section className="adm-card" aria-label="Team">
          <div className="adm-table-wrap desktop-only">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Works</th>
                  <th scope="col" className="num">
                    Visits, 30 days
                  </th>
                  <th scope="col" className="num">
                    Takings
                  </th>
                  <th scope="col" className="num">
                    Commission
                  </th>
                  <th scope="col" className="num">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ staff, visits, revenue, commission }) => (
                  <tr key={staff.id} onClick={() => setEditing(staff)} style={{ opacity: staff.active ? 1 : 0.55 }}>
                    <td>
                      <span className="inline" style={{ gap: 12 }}>
                        <Avatar name={staff.name} size={32} soft />
                        <span style={{ fontWeight: 500 }}>{staff.name}</span>
                        {!staff.active && <span className="pill-tag">Not working</span>}
                      </span>
                    </td>
                    <td>{ROLE_LABEL[staff.role]}</td>
                    <td>{branchById(staff.branchId)?.name}</td>
                    <td>
                      <WeekDays days={staff.days} />
                    </td>
                    <td className="num">{visits}</td>
                    <td className="num">{money(revenue)}</td>
                    <td className="num">
                      {money(commission)} <span className="muted">· {Math.round(staff.commission * 100)}%</span>
                    </td>
                    <td className="num">
                      <button
                        className="icon-btn is-plain"
                        style={{ width: 34, height: 34 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(staff);
                        }}
                        aria-label={`Edit ${staff.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-rows mobile-only" style={{ paddingBlock: 4 }}>
            {rows.map(({ staff, visits, commission }) => (
              <button key={staff.id} className="adm-row" onClick={() => setEditing(staff)} style={{ opacity: staff.active ? 1 : 0.55 }}>
                <Avatar name={staff.name} size={40} soft />
                <span className="grow stack" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>
                    {staff.name} {!staff.active && <span className="pill-tag">Not working</span>}
                  </span>
                  <span className="t-cap muted truncate">
                    {ROLE_LABEL[staff.role]} · {branchById(staff.branchId)?.name} · {plural(visits, "visit")}
                  </span>
                </span>
                <span className="tabular" style={{ whiteSpace: "nowrap" }}>
                  {money(commission)}
                </span>
                <Pencil size={15} className="row-chevron" />
              </button>
            ))}
          </div>
          <div className="adm-card-foot">
            <span className="adm-meta">Commission is worked out on finished visits in the last 30 days.</span>
          </div>
        </section>
      )}

      <StaffSheet member={editing} onClose={() => setEditing(null)} />
    </AdminPage>
  );
}

function StaffSheet({ member, onClose }: { member: StaffMember | "new" | null; onClose: () => void }) {
  const notify = useNotify();
  const scope = useBranchScope();
  const isNew = member === "new";
  const blank: Omit<StaffMember, "id"> = { name: "", branchId: scope === "all" ? BRANCHES[0]!.id : scope, role: "stylist", groups: ["hair"], days: [1, 2, 3, 4, 5, 6], commission: 0.35, active: true };
  const [draft, setDraft] = useState<Omit<StaffMember, "id">>(blank);
  const [commission, setCommission] = useState("35");
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Reset the form whenever a different person is opened.
  const key = member === null ? null : isNew ? "new" : member.id;
  if (key !== lastKey) {
    setLastKey(key);
    const next = member && member !== "new" ? member : blank;
    setDraft(next);
    setCommission(String(Math.round(next.commission * 100)));
    setError(null);
  }

  const toggleGroup = (group: ServiceGroup) => setDraft((d) => ({ ...d, groups: d.groups.includes(group) ? d.groups.filter((g) => g !== group) : [...d.groups, group] }));
  const toggleDay = (day: number) => setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day].sort() }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!commission.trim()) return setError("Enter their commission, or 0 if they're on a flat wage.");
    const next = { ...draft, commission: Number(commission.replace(/[^\d.]/g, "")) / 100 };
    const result = isNew ? desk.addStaff(next) : member ? desk.saveStaff(member.id, next) : { error: "Nothing to save." };
    if ("error" in result) return setError(result.error);
    notify(isNew ? "Staff added" : "Staff saved", `${result.staff.name} is ${result.staff.active ? "taking bookings" : "marked as not working"}.`);
    onClose();
  };

  return (
    <Sheet open={member !== null} onClose={onClose} title={isNew ? "Add staff" : `Edit ${draft.name || "staff"}`}>
      <form className="stack gap-16" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="staff-name">Name</label>
          <input id="staff-name" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
        </div>
        <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="staff-role">Role</label>
            <Dropdown<StaffRole> id="staff-role" variant="field" value={draft.role} onChange={(r) => setDraft({ ...draft, role: r })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          </div>
          <div className="field">
            <label htmlFor="staff-branch">Branch</label>
            <Dropdown id="staff-branch" variant="field" value={draft.branchId} onChange={(b) => setDraft({ ...draft, branchId: b })} options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
        </div>
        <fieldset className="stack gap-8" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="adm-meta" style={{ marginBottom: 8 }}>
            Takes bookings for
          </legend>
          <div className="walkin-chips">
            {GROUPS.map((g) => (
              <button key={g.id} type="button" className={`chip ${draft.groups.includes(g.id) ? "is-active" : ""}`} onClick={() => toggleGroup(g.id)} aria-pressed={draft.groups.includes(g.id)}>
                {GROUP_LABEL[g.id]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="stack gap-8" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="adm-meta" style={{ marginBottom: 8 }}>
            Works on
          </legend>
          <div className="week-days is-editable">
            {WEEK.map((day) => (
              <button key={day} type="button" className={draft.days.includes(day) ? "is-on" : ""} onClick={() => toggleDay(day)} aria-pressed={draft.days.includes(day)} aria-label={DAY_NAMES[day]}>
                {DAY_LETTERS[day]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor="staff-commission">Commission (%)</label>
          <input id="staff-commission" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          <span className="hint">Share of each finished service they earn.</span>
        </div>
        <label className="check-row">
          <input type="checkbox" className="cbx" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          <span>Taking bookings</span>
        </label>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" block type="submit" icon={isNew ? <Plus size={16} /> : undefined}>
          {isNew ? "Add to the team" : "Save changes"}
        </Button>
      </form>
    </Sheet>
  );
}
