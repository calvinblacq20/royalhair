import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { actions, desk, useAppData } from "../../data/store";
import type { Branch } from "../../data/types";
import { ConfirmSheet } from "../sheets";
import { AdminPage } from "../Shell";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Settings() {
  const data = useAppData();
  const notify = useNotify();
  const [salon, setSalon] = useState(data.settings.salon);
  const [policies, setPolicies] = useState(data.settings.policies);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  const saveSalon = () => {
    const result = desk.saveSettings({ salon, policies });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    notify("Saved", "Salon details and booking rules are updated.");
  };

  return (
    <AdminPage title="Settings" status="Salon details, branches and booking rules">
      <div className="adm-stack settings">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">The salon</h2>
          </div>
          <div className="adm-card-body settings-grid">
            <label className="field">
              <span>Name</span>
              <input value={salon.name} onChange={(e) => setSalon({ ...salon, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Main WhatsApp number</span>
              <input value={salon.phone} onChange={(e) => setSalon({ ...salon, phone: e.target.value })} inputMode="tel" />
            </label>
            <label className="field">
              <span>MoMo number for payments</span>
              <input value={salon.momo} onChange={(e) => setSalon({ ...salon, momo: e.target.value })} inputMode="tel" />
            </label>
            <label className="field">
              <span>MoMo account name</span>
              <input value={salon.momoName} onChange={(e) => setSalon({ ...salon, momoName: e.target.value })} />
            </label>
            <label className="field">
              <span>Instagram link</span>
              <input value={salon.instagram} onChange={(e) => setSalon({ ...salon, instagram: e.target.value })} inputMode="url" />
            </label>
            <label className="field">
              <span>TikTok link</span>
              <input value={salon.tiktok} onChange={(e) => setSalon({ ...salon, tiktok: e.target.value })} inputMode="url" />
            </label>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">Booking rules</h2>
          </div>
          <div className="adm-card-body settings-grid">
            <label className="field">
              <span>Deposit to hold a booking (%)</span>
              <input
                inputMode="numeric"
                value={Math.round(policies.depositRate * 100)}
                onChange={(e) => setPolicies({ ...policies, depositRate: Number(e.target.value.replace(/\D/g, "")) / 100 })}
              />
            </label>
            <label className="field">
              <span>Free cancellation until (hours before)</span>
              <input
                inputMode="numeric"
                value={policies.cancelWindowHours}
                onChange={(e) => setPolicies({ ...policies, cancelWindowHours: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              />
            </label>
            <label className="field">
              <span>Clean-down between clients (minutes)</span>
              <input
                inputMode="numeric"
                value={policies.turnaroundMinutes}
                onChange={(e) => setPolicies({ ...policies, turnaroundMinutes: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              />
            </label>
            <label className="field settings-wide">
              <span>Receipt footer</span>
              <input value={policies.receiptFooter} onChange={(e) => setPolicies({ ...policies, receiptFooter: e.target.value })} />
            </label>
          </div>
          <div className="adm-card-foot">
            {error && (
              <p className="field-error grow" role="alert">
                {error}
              </p>
            )}
            <Button variant="dark" onClick={saveSalon}>
              Save
            </Button>
          </div>
        </section>

        {data.branches.map((branch) => (
          <BranchCard key={branch.id} branch={branch} />
        ))}

        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">Demo data</h2>
          </div>
          <div className="adm-card-body stack gap-12">
            <p className="muted">Puts every booking, client, price and setting back to the starting sample salon.</p>
            <div>
              <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setResetOpen(true)}>
                Reset demo
              </Button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the whole demo?"
        body="This clears everything changed since the demo started. It can't be undone."
        confirmLabel="Reset everything"
        danger
        onConfirm={() => {
          actions.resetDemo();
          setResetOpen(false);
          notify("Demo reset", "Everything is back to the starting data.");
          window.location.reload();
        }}
      />
    </AdminPage>
  );
}

function BranchCard({ branch }: { branch: Branch }) {
  const notify = useNotify();
  const [draft, setDraft] = useState(branch);
  const [error, setError] = useState("");

  const setHours = (day: number, index: 0 | 1, value: string) => {
    const hours = [...draft.hours];
    const current = hours[day] ?? ["09:00", "18:00"];
    hours[day] = index === 0 ? [value, current[1]] : [current[0], value];
    setDraft({ ...draft, hours });
  };

  const toggleDay = (day: number, open: boolean) => {
    const hours = [...draft.hours];
    hours[day] = open ? ["09:00", "18:00"] : null;
    setDraft({ ...draft, hours });
  };

  const save = () => {
    const result = desk.saveBranch(branch.id, draft);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    notify("Saved", `${result.branch.name} is updated on the site.`);
  };

  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <h2 className="t-title">{branch.name}</h2>
        <label className="check-row" style={{ padding: 0 }}>
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          <span className="adm-meta">Open for bookings</span>
        </label>
      </div>
      <div className="adm-card-body stack gap-16">
        <div className="settings-grid">
          <label className="field">
            <span>Name</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Branch phone</span>
            <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" />
          </label>
          <label className="field settings-wide">
            <span>Address</span>
            <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </label>
          <label className="field settings-wide">
            <span>How to find it (landmarks)</span>
            <input value={draft.landmark ?? ""} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })} placeholder="e.g. Ground floor, opposite the food court" />
          </label>
          <label className="field">
            <span>Chairs</span>
            <input inputMode="numeric" value={draft.chairs} onChange={(e) => setDraft({ ...draft, chairs: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </label>
        </div>

        <div className="stack gap-8">
          <span className="adm-meta">Opening hours</span>
          <div className="hours-table">
            {WEEKDAYS.map((label, day) => {
              const span = draft.hours[day];
              return (
                <div key={label} className="hours-row">
                  <label className="check-row" style={{ padding: 0 }}>
                    <input type="checkbox" checked={Boolean(span)} onChange={(e) => toggleDay(day, e.target.checked)} />
                    <span>{label}</span>
                  </label>
                  {span ? (
                    <span className="inline gap-8">
                      <input className="adm-input hours-input" type="time" value={span[0]} onChange={(e) => setHours(day, 0, e.target.value)} aria-label={`${label} opens`} />
                      <span className="subtle">to</span>
                      <input className="adm-input hours-input" type="time" value={span[1]} onChange={(e) => setHours(day, 1, e.target.value)} aria-label={`${label} closes`} />
                    </span>
                  ) : (
                    <span className="subtle">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="adm-card-foot">
        {error && (
          <p className="field-error grow" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" onClick={save}>
          Save {branch.name}
        </Button>
      </div>
    </section>
  );
}
