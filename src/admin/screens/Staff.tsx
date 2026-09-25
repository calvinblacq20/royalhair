import { Plus, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { BRANCHES, branchById } from "../../data/business";
import { GROUP_LABEL, GROUPS, ROLE_LABEL } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { ServiceGroup, Staff as StaffMember, StaffRole } from "../../data/types";
import { addDays, money, startOfDay } from "../../lib/format";
import { earningsByStaff } from "../../lib/metrics";
import { useBranchScope } from "../branch";
import { useNow } from "../hooks";
import { AdminPage, BranchSwitch, EmptyState } from "../Shell";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Staff() {
  const data = useAppData();
  const now = useNow();
  const scope = useBranchScope();
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);

  const monthStart = startOfDay(addDays(now, -29));
  const team = data.staff.filter((s) => scope === "all" || s.branchId === scope);
  const earnings = earningsByStaff(data.visits, team, monthStart, now);

  return (
    <AdminPage
      title="Staff"
      status={`${team.filter((s) => s.active).length} working · earnings over the last 30 days`}
      actions={
        <>
          <BranchSwitch />
          <Cta onClick={() => setEditing("new")}>Add staff</Cta>
        </>
      }
    >
      {team.length === 0 ? (
        <EmptyState icon={<UserRoundCheck size={24} />} title="No staff at this branch" action={<Button onClick={() => setEditing("new")}>Add the first one</Button>} />
      ) : (
        <div className="staff-grid">
          {earnings.map(({ staff, visits, revenue, commission }) => (
            <button key={staff.id} className={`adm-card staff-card ${staff.active ? "" : "is-inactive"}`} onClick={() => setEditing(staff)}>
              <div className="adm-card-body stack gap-12">
                <div className="inline gap-12">
                  <Avatar name={staff.name} size={44} soft />
                  <div className="stack gap-4" style={{ minWidth: 0 }}>
                    <span className="t-title truncate">{staff.name}</span>
                    <span className="muted t-cap truncate">
                      {ROLE_LABEL[staff.role]} · {branchById(staff.branchId)?.name}
                    </span>
                  </div>
                </div>
                <div className="week-days" aria-label={`Works ${staff.days.map((d) => DAY_NAMES[d]).join(", ")}`}>
                  {DAY_LETTERS.map((letter, day) => (
                    <span key={day} className={staff.days.includes(day) ? "is-on" : ""} aria-hidden="true">
                      {letter}
                    </span>
                  ))}
                </div>
                <div className="kv t-cap">
                  <span className="muted">{visits} visits · {Math.round(staff.commission * 100)}% commission</span>
                  <span className="tabular">{money(commission)}</span>
                </div>
                <div className="kv t-cap subtle">
                  <span>Takings</span>
                  <span className="tabular">{money(revenue)}</span>
                </div>
                {!staff.active && <span className="adm-meta">Not currently working</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <StaffSheet member={editing} onClose={() => setEditing(null)} />
    </AdminPage>
  );
}

function StaffSheet({ member, onClose }: { member: StaffMember | "new" | null; onClose: () => void }) {
  const notify = useNotify();
  const scope = useBranchScope();
  const isNew = member === "new";
  const base: Omit<StaffMember, "id"> =
    member && member !== "new"
      ? member
      : { name: "", branchId: scope === "all" ? BRANCHES[0]!.id : scope, role: "stylist", groups: ["hair"], days: [1, 2, 3, 4, 5, 6], commission: 0.35, active: true };
  const [draft, setDraft] = useState(base);
  const [error, setError] = useState("");
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Reset the form whenever a different person is opened.
  const key = member === null ? null : isNew ? "new" : member.id;
  if (key !== lastKey) {
    setLastKey(key);
    setDraft(base);
    setError("");
  }

  const toggleGroup = (group: ServiceGroup) =>
    setDraft((d) => ({ ...d, groups: d.groups.includes(group) ? d.groups.filter((g) => g !== group) : [...d.groups, group] }));
  const toggleDay = (day: number) =>
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day].sort() }));

  const save = () => {
    const result = isNew ? desk.addStaff(draft) : member ? desk.saveStaff(member.id, draft) : { error: "Nothing to save." };
    if ("error" in result) {
      setError(result.error);
      return;
    }
    notify(isNew ? "Staff added" : "Saved", `${result.staff.name} is ${result.staff.active ? "on the team" : "marked as not working"}.`);
    onClose();
  };

  return (
    <Sheet open={member !== null} onClose={onClose} title={isNew ? "Add staff" : "Edit staff"}>
      <div className="stack gap-16">
        <label className="field">
          <span>Name</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="walkin-new">
          <label className="field">
            <span>Role</span>
            <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })}>
              {Object.entries(ROLE_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Branch</span>
            <select value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
              {BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="stack gap-8">
          <span className="adm-meta">Takes bookings for</span>
          <div className="walkin-chips">
            {GROUPS.map((g) => (
              <button key={g.id} className={`chip ${draft.groups.includes(g.id) ? "is-active" : ""}`} onClick={() => toggleGroup(g.id)} aria-pressed={draft.groups.includes(g.id)}>
                {GROUP_LABEL[g.id]}
              </button>
            ))}
          </div>
        </div>
        <div className="stack gap-8">
          <span className="adm-meta">Works on</span>
          <div className="week-days is-editable">
            {DAY_LETTERS.map((letter, day) => (
              <button key={day} className={draft.days.includes(day) ? "is-on" : ""} onClick={() => toggleDay(day)} aria-pressed={draft.days.includes(day)} aria-label={DAY_NAMES[day]}>
                {letter}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Commission (%)</span>
          <input
            inputMode="numeric"
            value={Math.round(draft.commission * 100)}
            onChange={(e) => setDraft({ ...draft, commission: Number(e.target.value.replace(/\D/g, "")) / 100 })}
          />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          <span className="muted">Currently working (unticked staff take no new bookings)</span>
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" block onClick={save} icon={isNew ? <Plus size={16} /> : undefined}>
          {isNew ? "Add to the team" : "Save changes"}
        </Button>
      </div>
    </Sheet>
  );
}
