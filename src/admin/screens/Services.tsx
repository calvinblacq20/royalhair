import { Eye, EyeOff, Pencil, RotateCcw } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Photo } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { GROUP_LABEL, GROUPS, servicePhoto } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { Service, ServiceGroup } from "../../data/types";
import { money, parseLocal, plural } from "../../lib/format";
import { durationLabel } from "../../lib/pricing";
import { periodRange } from "../../lib/trends";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";
import { ConfirmSheet } from "../sheets";

const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));
const priceText = (s: Service) => `${s.priceFrom ? "from " : ""}${money(s.price)}`;

/** The price list the client sees. Changing a price never rewrites a booking already made. */
export function Services() {
  const data = useAppData();
  const now = useNow();
  const notify = useNotify();
  const [group, setGroup] = useState<ServiceGroup | "all">("all");
  const [editing, setEditing] = useState<Service | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const recent = useMemo(() => {
    const range = periodRange("90d", now);
    const counts = new Map<string, number>();
    for (const v of data.visits) {
      const t = parseLocal(v.start);
      if (t < range.start || t >= range.end || v.status !== "done") continue;
      for (const item of v.items) counts.set(item.serviceId, (counts.get(item.serviceId) ?? 0) + 1);
    }
    return counts;
  }, [data.visits, now]);

  const services = data.services.filter((s) => group === "all" || s.group === group);
  const hidden = data.services.filter((s) => s.active === false).length;

  const toggle = (service: Service) => {
    const result = desk.saveService(service.id, { active: service.active === false });
    if ("error" in result) return notify("Couldn't save", result.error);
    notify(service.active === false ? "Service shown again" : "Service hidden", service.active === false ? `${service.name} is back on the price list.` : `${service.name} is hidden from clients. Bookings already made are not affected.`);
  };

  return (
    <AdminPage
      title="Services & prices"
      status={
        <>
          {plural(data.services.length, "service")} · {hidden ? `${hidden} hidden · ` : ""}prices clients see when they book
        </>
      }
    >
      <div className="chips" role="radiogroup" aria-label="Part of the salon" style={{ margin: "0 0 16px" }}>
        {[{ id: "all" as const, label: "All" }, ...GROUPS].map((g) => (
          <button key={g.id} role="radio" aria-checked={group === g.id} className={`chip ${group === g.id ? "is-active" : ""}`} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <section className="adm-card" aria-label="Services">
        <div className="adm-table-wrap desktop-only">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Part of the salon</th>
                <th scope="col" className="num">
                  Price
                </th>
                <th scope="col" className="num">
                  Takes
                </th>
                <th scope="col" className="num">
                  Due back after
                </th>
                <th scope="col" className="num">
                  Done, 90 days
                </th>
                <th scope="col" className="num">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} style={{ cursor: "default", opacity: s.active === false ? 0.55 : 1 }}>
                  <td>
                    <span className="inline" style={{ gap: 12 }}>
                      <Photo tone={s.tone} src={servicePhoto(s)} sizes="36px" height={36} radius={6} markSize={14} className="style-mini" />
                      <span style={{ fontWeight: 500 }}>{s.name}</span>
                      {s.active === false && <span className="pill-tag">Hidden</span>}
                      {!s.bookable && s.active !== false && <span className="pill-tag">Desk only</span>}
                      {s.featured && <span className="pill-tag">Featured</span>}
                    </span>
                  </td>
                  <td>{GROUP_LABEL[s.group]}</td>
                  <td className="num">{priceText(s)}</td>
                  <td className="num">{durationLabel(s.minutes)}</td>
                  <td className="num">{s.repeatWeeks ? plural(s.repeatWeeks, "week") : "–"}</td>
                  <td className="num">{recent.get(s.id) ?? 0}</td>
                  <td className="num">
                    <span className="inline" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => toggle(s)} aria-label={s.active === false ? `Show ${s.name} to clients` : `Hide ${s.name} from clients`}>
                        {s.active === false ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                        <Pencil size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-rows mobile-only" style={{ paddingBlock: 4 }}>
          {services.map((s) => (
            <button key={s.id} className="adm-row" onClick={() => setEditing(s)} style={{ opacity: s.active === false ? 0.55 : 1 }}>
              <Photo tone={s.tone} src={servicePhoto(s)} sizes="40px" height={40} radius={8} markSize={14} className="style-mini" />
              <span className="grow stack" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 500 }}>
                  {s.name} {s.active === false && <span className="pill-tag">Hidden</span>}
                </span>
                <span className="t-cap muted">
                  {durationLabel(s.minutes)} · {recent.get(s.id) ?? 0} done in 90 days
                </span>
              </span>
              <span className="tabular" style={{ whiteSpace: "nowrap" }}>
                {priceText(s)}
              </span>
              <Pencil size={15} className="row-chevron" />
            </button>
          ))}
        </div>
        <div className="adm-card-foot">
          <span className="adm-meta">Braids, locs and weaves show “from”: length and size are priced at the chair.</span>
          <button className="adm-link" onClick={() => setResetOpen(true)}>
            <RotateCcw size={14} /> Reset all prices
          </button>
        </div>
      </section>

      <ServiceSheet service={editing} onClose={() => setEditing(null)} />
      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the price list?"
        body="Every service goes back to its starting name, price and length, and hidden services come back. Bookings already made keep the price they were booked at."
        confirmLabel="Reset prices"
        onConfirm={() => {
          desk.resetServices();
          setResetOpen(false);
          notify("Prices reset", "The price list is back to its starting prices.");
        }}
      />
    </AdminPage>
  );
}

function ServiceSheet({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const notify = useNotify();
  const [form, setForm] = useState({ name: "", description: "", price: "", minutes: "", repeatWeeks: "", priceFrom: false, bookable: true, featured: false, active: true });
  const [forId, setForId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (service && service.id !== forId) {
    setForId(service.id);
    setForm({
      name: service.name,
      description: service.description,
      price: String(service.price),
      minutes: String(service.minutes),
      repeatWeeks: String(service.repeatWeeks),
      priceFrom: Boolean(service.priceFrom),
      bookable: service.bookable,
      featured: Boolean(service.featured),
      active: service.active !== false,
    });
    setError(null);
  }

  const close = () => {
    setForId(null);
    onClose();
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    if (!form.price.trim()) return setError("Enter a price. Use 0 only for a free service.");
    const result = desk.saveService(service.id, {
      name: form.name,
      description: form.description,
      price: toNumber(form.price),
      minutes: Math.round(toNumber(form.minutes)),
      repeatWeeks: Math.round(toNumber(form.repeatWeeks)),
      priceFrom: form.priceFrom,
      bookable: form.bookable,
      featured: form.featured,
      active: form.active,
    });
    if ("error" in result) return setError(result.error);
    close();
    notify("Service saved", `${result.service.name} is now ${priceText(result.service)}.`);
  };

  return (
    <Sheet open={service !== null} onClose={close} title={service ? `Edit ${service.name}` : "Edit service"}>
      {service && (
        <form className="stack gap-16" onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor="service-name">Name</label>
            <input id="service-name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="service-desc">What's included, as clients see it</label>
            <textarea id="service-desc" rows={3} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="service-price">Price (GH₵)</label>
              <input id="service-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="service-minutes">Takes (minutes)</label>
              <input id="service-minutes" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
              <span className="hint">How long the chair is booked.</span>
            </div>
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="service-repeat">Due back after (weeks)</label>
            <input id="service-repeat" inputMode="numeric" value={form.repeatWeeks} onChange={(e) => setForm({ ...form, repeatWeeks: e.target.value })} />
            <span className="hint">0 if it has no natural repeat. Drives the “Due back” list.</span>
          </div>
          <div className="stack">
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: e.target.checked })} />
              <span>Show as “from” (length or size changes the price)</span>
            </label>
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.bookable} onChange={(e) => setForm({ ...form, bookable: e.target.checked })} />
              <span>Clients can book it online</span>
            </label>
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Show on the price list</span>
            </label>
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              <span>Feature on the home page</span>
            </label>
          </div>
          {error && (
            <p className="adm-form-error" role="alert">
              {error}
            </p>
          )}
          <p className="t-cap muted">New prices apply to new bookings only. Bookings already made keep their price.</p>
          <Button variant="dark" block type="submit">
            Save service
          </Button>
        </form>
      )}
    </Sheet>
  );
}
