import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import type { SalonSettings } from "../../data/business";
import { actions, desk, useAppData } from "../../data/store";
import type { Branch } from "../../data/types";
import { CardHead } from "../controls";
import { AdminPage } from "../Shell";
import { ConfirmSheet } from "../sheets";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_SPAN: [string, string] = ["09:00", "18:00"];
const digits = (v: string) => Number(v.replace(/\D/g, "")) || 0;

type Salon = SalonSettings["salon"];
type Policies = SalonSettings["policies"];

/**
 * Keeps the draft in step with saved data when it changes elsewhere, without an effect.
 * Compared by value: saving one card rebuilds every settings object, and that must not
 * wipe another card's unsaved edits.
 */
function useDraft<T>(saved: T): [T, (next: T) => void, () => void] {
  const key = JSON.stringify(saved);
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(key);
  if (base !== key) {
    setBase(key);
    setDraft(saved);
  }
  return [draft, setDraft, () => setDraft(saved)];
}

export function Settings() {
  const notify = useNotify();
  const data = useAppData();
  const [resetOpen, setResetOpen] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  return (
    <AdminPage title="Settings" status={<>Salon details, branches, hours and booking rules. Changes show on the client app too.</>}>
      <div className="adm-grid adm-grid-2" style={{ maxWidth: 1040, alignItems: "start" }}>
        <SalonCard salon={data.settings.salon} />
        <PoliciesCard policies={data.settings.policies} />
        {data.branches.map((b) => (
          <BranchCard key={b.id} branch={b} />
        ))}
        <section className="adm-card" aria-labelledby="demo">
          <CardHead id="demo" title="Demo" />
          <div className="adm-card-body stack gap-12">
            <p className="muted">All data is sample data kept in this browser. Resetting brings back the original bookings, clients and payments on both the client and salon sides.</p>
            <div className="adm-actions">
              <Button icon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
                Reset demo data
              </Button>
              <Button icon={<RotateCcw size={16} />} onClick={() => setDefaultsOpen(true)}>
                Reset these settings
              </Button>
              <a className="btn btn-soft" href="#/">
                <ArrowUpRight size={16} /> Open client app
              </a>
            </div>
          </div>
        </section>
      </div>

      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        danger
        title="Reset the demo?"
        body="Every change made in this browser is replaced with the original sample data. This can't be undone."
        confirmLabel="Reset"
        onConfirm={() => {
          actions.resetDemo();
          setResetOpen(false);
          notify("Demo reset", "Sample bookings, clients and payments are back.");
        }}
      />
      <ConfirmSheet
        open={defaultsOpen}
        onClose={() => setDefaultsOpen(false)}
        title="Put settings back?"
        body="The salon details, booking rules, branches and opening hours go back to the ones the app shipped with. Bookings and clients aren't touched."
        confirmLabel="Reset settings"
        onConfirm={() => {
          desk.resetSettings();
          desk.resetBranches();
          setDefaultsOpen(false);
          notify("Settings reset", "Salon details, branches and hours are back to the defaults.");
        }}
      />
    </AdminPage>
  );
}

/** A card whose fields are saved together; the button wakes up once something changes. */
function EditCard({ id, title, dirty, onSave, onReset, error, action, children }: { id: string; title: string; dirty: boolean; onSave: (e: FormEvent) => void; onReset: () => void; error: string | null; action?: ReactNode; children: ReactNode }) {
  return (
    <form className="adm-card" aria-labelledby={id} onSubmit={onSave} noValidate>
      <CardHead id={id} title={title} action={dirty ? <span className="pill-tag">Unsaved</span> : action} />
      <div className="adm-card-body stack gap-16">{children}</div>
      {error && (
        <p className="adm-form-error" role="alert" style={{ padding: "0 20px 8px" }}>
          {error}
        </p>
      )}
      <div className="adm-card-foot">
        <button type="button" className="adm-link" onClick={onReset} style={{ visibility: dirty ? "visible" : "hidden" }}>
          Undo changes
        </button>
        <Button variant="dark" size="sm" type="submit" disabled={!dirty}>
          Save
        </Button>
      </div>
    </form>
  );
}

function SalonCard({ salon }: { salon: Salon }) {
  const notify = useNotify();
  const [form, setForm, undo] = useDraft(salon);
  const [error, setError] = useState<string | null>(null);
  const dirty = (Object.keys(form) as (keyof Salon)[]).some((k) => form[k] !== salon[k]);
  const field = (key: keyof Salon, label: string, hint?: string, type: "text" | "tel" | "url" | "textarea" = "text") => (
    <div className="field">
      <label htmlFor={`salon-${key}`}>{label}</label>
      {type === "textarea" ? (
        <textarea id={`salon-${key}`} rows={4} value={String(form[key])} maxLength={800} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ) : (
        <input id={`salon-${key}`} type={type} inputMode={type === "tel" ? "tel" : type === "url" ? "url" : undefined} value={String(form[key])} maxLength={200} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );

  return (
    <EditCard
      id="salon"
      title="The salon"
      dirty={dirty}
      error={error}
      onReset={() => {
        undo();
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = desk.saveSettings({ salon: form });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Salon details saved", "Receipts, WhatsApp messages and the client app now use them.");
      }}
    >
      {field("name", "Salon name")}
      {field("phone", "Main WhatsApp number", "Bookings and questions from the client app go here.", "tel")}
      {field("momo", "MoMo number for payments", "Clients send MoMo to this number when they pay at the desk.", "tel")}
      {field("momoName", "MoMo account name", "Clients check this name before they send money.")}
      {field("landline", "Landline", undefined, "tel")}
      {field("email", "Email")}
      {field("instagram", "Instagram link", undefined, "url")}
      {field("tiktok", "TikTok link", undefined, "url")}
      {field("about", "About the salon", "The paragraph on the home page.", "textarea")}
    </EditCard>
  );
}

function PoliciesCard({ policies }: { policies: Policies }) {
  const notify = useNotify();
  const [form, setForm, undo] = useDraft(policies);
  const [error, setError] = useState<string | null>(null);
  const dirty = (Object.keys(form) as (keyof Policies)[]).some((k) => form[k] !== policies[k]);

  return (
    <EditCard
      id="policies"
      title="Booking rules"
      dirty={dirty}
      error={error}
      onReset={() => {
        undo();
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = desk.saveSettings({ policies: form });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Booking rules saved", "New bookings follow the new rules.");
      }}
    >
      <div className="field">
        <label htmlFor="policy-cancel">Notice asked for before cancelling (hours)</label>
        <input id="policy-cancel" inputMode="numeric" value={form.cancelWindowHours} onChange={(e) => setForm({ ...form, cancelWindowHours: digits(e.target.value) })} />
        <span className="hint">How much notice clients are asked to give before cancelling or moving a booking.</span>
      </div>
      <div className="field">
        <label htmlFor="policy-turnaround">Clean-down between clients (minutes)</label>
        <input id="policy-turnaround" inputMode="numeric" value={form.turnaroundMinutes} onChange={(e) => setForm({ ...form, turnaroundMinutes: digits(e.target.value) })} />
        <span className="hint">Online bookings leave this gap after every visit. The desk can still seat someone sooner.</span>
      </div>
      <div className="field">
        <label htmlFor="policy-footer">Receipt footer</label>
        <textarea id="policy-footer" rows={2} value={form.receiptFooter} maxLength={200} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} />
      </div>
    </EditCard>
  );
}

function BranchCard({ branch }: { branch: Branch }) {
  const notify = useNotify();
  const [form, setForm, undo] = useDraft(branch);
  const [error, setError] = useState<string | null>(null);
  const sameHours = WEEK.every((d) => (form.hours[d]?.[0] ?? "") === (branch.hours[d]?.[0] ?? "") && (form.hours[d]?.[1] ?? "") === (branch.hours[d]?.[1] ?? ""));
  const dirty = !sameHours || (["name", "phone", "address", "landmark", "chairs", "active"] as const).some((k) => (form[k] ?? "") !== (branch[k] ?? ""));
  const setDay = (day: number, span: readonly [string, string] | null) => {
    const hours = [...form.hours];
    hours[day] = span;
    setForm({ ...form, hours });
  };
  const id = `branch-${branch.id}`;

  return (
    <EditCard
      id={id}
      title={branch.name}
      dirty={dirty}
      error={error}
      action={!branch.active ? <span className="pill-tag">Not taking bookings</span> : undefined}
      onReset={() => {
        undo();
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = desk.saveBranch(branch.id, { name: form.name, phone: form.phone, address: form.address, landmark: form.landmark, chairs: form.chairs, active: form.active, hours: form.hours });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify(`${result.branch.name} saved`, "Booking slots and the open or closed status follow the new details.");
      }}
    >
      <label className="check-row">
        <input type="checkbox" className="cbx" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        <span>Taking bookings</span>
      </label>
      <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
        <div className="field">
          <label htmlFor={`${id}-name`}>Branch name</label>
          <input id={`${id}-name`} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>Branch phone</label>
          <input id={`${id}-phone`} type="tel" inputMode="tel" value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-address`}>Address on receipts</label>
        <input id={`${id}-address`} value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-landmark`}>How to find it</label>
        <input id={`${id}-landmark`} value={form.landmark ?? ""} maxLength={200} onChange={(e) => setForm({ ...form, landmark: e.target.value })} placeholder="e.g. Ground floor, opposite the food court" />
        <span className="hint">Shown with the map. People here find places by landmark.</span>
      </div>
      <div className="field" style={{ maxWidth: 200 }}>
        <label htmlFor={`${id}-chairs`}>Chairs</label>
        <input id={`${id}-chairs`} inputMode="numeric" value={form.chairs} onChange={(e) => setForm({ ...form, chairs: digits(e.target.value) })} />
      </div>
      <div className="stack gap-8">
        <span className="adm-meta">Opening hours</span>
        {WEEK.map((day) => {
          const span = form.hours[day];
          return (
            <div key={day} className="between" style={{ gap: 12, flexWrap: "wrap" }}>
              <label className="check-row" style={{ minWidth: 150 }}>
                <input type="checkbox" className="cbx" checked={Boolean(span)} onChange={(e) => setDay(day, e.target.checked ? DEFAULT_SPAN : null)} />
                <span>{DAY_NAMES[day]}</span>
              </label>
              {span ? (
                <span className="inline" style={{ gap: 8 }}>
                  <input className="adm-input" style={{ width: 118, height: 40 }} type="time" value={span[0]} aria-label={`${DAY_NAMES[day]} opens`} onChange={(e) => setDay(day, [e.target.value, span[1]])} />
                  <span className="muted">to</span>
                  <input className="adm-input" style={{ width: 118, height: 40 }} type="time" value={span[1]} aria-label={`${DAY_NAMES[day]} closes`} onChange={(e) => setDay(day, [span[0], e.target.value])} />
                </span>
              ) : (
                <span className="muted">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </EditCard>
  );
}
