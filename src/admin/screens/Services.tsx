import { RotateCcw, Scissors } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { GROUPS } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { Service } from "../../data/types";
import { money } from "../../lib/format";
import { durationLabel } from "../../lib/pricing";
import { ConfirmSheet } from "../sheets";
import { AdminPage, EmptyState } from "../Shell";

/** The price list the client sees. Changing a price never rewrites a booking already made. */
export function Services() {
  const data = useAppData();
  const notify = useNotify();
  const [editing, setEditing] = useState<Service | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <AdminPage
      title="Services & prices"
      status={`${data.services.filter((s) => s.active !== false).length} on the menu · prices shown to clients`}
      actions={
        <Button size="sm" icon={<RotateCcw size={15} />} onClick={() => setResetOpen(true)}>
          Reset prices
        </Button>
      }
    >
      <div className="adm-stack">
        {GROUPS.map((group) => {
          const items = data.services.filter((s) => s.group === group.id);
          if (!items.length) return null;
          return (
            <section key={group.id} className="adm-card">
              <div className="adm-card-head">
                <h2 className="t-title">{group.label}</h2>
                <span className="adm-meta">{items.length}</span>
              </div>
              <div className="adm-rows">
                {items.map((service) => (
                  <button key={service.id} className={`adm-row ${service.active === false ? "is-inactive" : ""}`} onClick={() => setEditing(service)}>
                    <span className="grow stack gap-4" style={{ minWidth: 0 }}>
                      <span className="t-title truncate">{service.name}</span>
                      <span className="muted t-cap truncate">
                        {durationLabel(service.minutes)}
                        {service.repeatWeeks ? ` · repeats every ${service.repeatWeeks} wk` : ""}
                        {!service.bookable ? " · not bookable online" : ""}
                        {service.active === false ? " · hidden" : ""}
                      </span>
                    </span>
                    <span className="tabular">
                      {service.priceFrom ? "from " : ""}
                      {money(service.price)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {data.services.length === 0 && <EmptyState icon={<Scissors size={24} />} title="No services" body="Reset prices to load the starting menu." />}
      </div>

      <ServiceSheet service={editing} onClose={() => setEditing(null)} onSaved={(name) => notify("Saved", `${name} is updated on the price list.`)} />
      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset every price?"
        body="Puts the whole menu back to the starting prices and durations. Bookings already made keep the price they were booked at."
        confirmLabel="Reset prices"
        danger
        onConfirm={() => {
          desk.resetServices();
          setResetOpen(false);
          notify("Prices reset", "The menu is back to the starting prices.");
        }}
      />
    </AdminPage>
  );
}

function ServiceSheet({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [draft, setDraft] = useState<Service | null>(service);
  const [error, setError] = useState("");
  if (service && draft?.id !== service.id) {
    setDraft(service);
    setError("");
  }
  if (!draft) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const save = () => {
    const result = desk.saveService(draft.id, {
      name: draft.name,
      description: draft.description,
      price: draft.price,
      priceFrom: draft.priceFrom,
      minutes: draft.minutes,
      repeatWeeks: draft.repeatWeeks,
      bookable: draft.bookable,
      active: draft.active,
    });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSaved(result.service.name);
    onClose();
  };

  return (
    <Sheet open={service !== null} onClose={onClose} title="Edit service">
      <div className="stack gap-16">
        <label className="field">
          <span>Name</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="field">
          <span>What's included</span>
          <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
        <div className="walkin-new">
          <label className="field">
            <span>Price (GH₵)</span>
            <input inputMode="decimal" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })} />
          </label>
          <label className="field">
            <span>Minutes</span>
            <input inputMode="numeric" value={String(draft.minutes)} onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </label>
        </div>
        <label className="field">
          <span>Repeat every (weeks, 0 for never)</span>
          <input inputMode="numeric" value={String(draft.repeatWeeks)} onChange={(e) => setDraft({ ...draft, repeatWeeks: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={Boolean(draft.priceFrom)} onChange={(e) => setDraft({ ...draft, priceFrom: e.target.checked })} />
          <span className="muted">Show as "from" (the final price depends on length or size)</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={draft.bookable} onChange={(e) => setDraft({ ...draft, bookable: e.target.checked })} />
          <span className="muted">Clients can book this online</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={draft.active !== false} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          <span className="muted">Show on the price list</span>
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" block onClick={save}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}
