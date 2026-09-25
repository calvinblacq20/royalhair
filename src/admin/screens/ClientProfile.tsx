import { AlertTriangle, CalendarPlus, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Badge } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { BRANCHES, branchById } from "../../data/business";
import { serviceById } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { HairRecord } from "../../data/types";
import { formatGhPhone, telLink, whatsappLink } from "../../lib/contact";
import { daysBetween, fmtDate, fmtTime, money, parseLocal } from "../../lib/format";
import { badgeFor, paidTotal } from "../../lib/visits";
import { useNow } from "../hooks";
import { VisitSheet } from "../sheets";
import { AdminPage, EmptyState } from "../Shell";

const SOURCE_LABEL = { instagram: "Instagram", tiktok: "TikTok", walkin: "Walked in", referral: "Referral", app: "Booked online" } as const;

/** Everything the stylist should know before the client sits down. */
export function ClientProfile() {
  const { clientId = "" } = useParams();
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const now = useNow();
  const customer = data.customers.find((c) => c.id === clientId);
  const [record, setRecord] = useState<HairRecord>(() => ({ ...customer?.hair }));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (!customer) {
    return (
      <AdminPage title="Client" back={{ to: "/admin/clients", label: "Clients" }}>
        <EmptyState icon={<AlertTriangle size={24} />} title="Client not found" body="They may have been removed, or the link is wrong." />
      </AdminPage>
    );
  }

  const visits = data.visits.filter((v) => v.customerId === customer.id).sort((a, b) => b.start.localeCompare(a.start));
  const spent = visits.reduce((sum, v) => sum + paidTotal(v), 0);
  const noShows = visits.filter((v) => v.status === "no-show").length;
  const branchStaff = data.staff.filter((s) => s.active);
  const relaxerDays = record.lastRelaxer ? daysBetween(parseLocal(record.lastRelaxer), now) : null;

  const edit = (patch: Partial<HairRecord>) => {
    setRecord((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const save = () => {
    const result = desk.saveHairRecord(customer.id, record);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    setDirty(false);
    notify("Saved", `${customer.name}'s hair record is up to date.`);
  };

  return (
    <AdminPage
      title={customer.name}
      back={{ to: "/admin/clients", label: "Clients" }}
      status={`${formatGhPhone(customer.phone)} · client since ${fmtDate(new Date(customer.memberSince))}`}
      actions={<Cta onClick={() => navigate(`/admin/walk-in?client=${customer.id}`)}>Book them in</Cta>}
    >
      <div className="client-layout">
        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card-body client-head">
              <Avatar name={customer.name} size={56} />
              <div className="client-stats">
                <div className="stack gap-4">
                  <span className="adm-meta">Visits</span>
                  <span className="t-title tabular">{visits.length}</span>
                </div>
                <div className="stack gap-4">
                  <span className="adm-meta">Spent</span>
                  <span className="t-title tabular">{money(spent)}</span>
                </div>
                <div className="stack gap-4">
                  <span className="adm-meta">No-shows</span>
                  <span className={`t-title tabular ${noShows ? "is-overdue" : ""}`}>{noShows}</span>
                </div>
                <div className="stack gap-4">
                  <span className="adm-meta">Found us</span>
                  <span className="t-title">{customer.source ? SOURCE_LABEL[customer.source] : "—"}</span>
                </div>
              </div>
            </div>
            <div className="adm-card-foot">
              <a className="btn btn-outline btn-sm" href={whatsappLink(customer.phone, `Hello ${customer.name.split(" ")[0]}, `)} target="_blank" rel="noreferrer">
                <MessageCircle size={15} strokeWidth={1.8} /> WhatsApp
              </a>
              <a className="btn btn-outline btn-sm" href={telLink(customer.phone)}>
                <Phone size={15} strokeWidth={1.8} /> Call
              </a>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="t-title">Visits</h2>
              <Link className="adm-link" to={`/admin/walk-in?client=${customer.id}`}>
                <CalendarPlus size={15} /> New
              </Link>
            </div>
            {visits.length === 0 ? (
              <p className="muted" style={{ padding: "0 20px 20px" }}>
                No visits yet.
              </p>
            ) : (
              <div className="adm-rows">
                {visits.map((visit) => {
                  const badge = badgeFor(visit, now);
                  const start = parseLocal(visit.start);
                  return (
                    <button key={visit.id} className="adm-row" onClick={() => setOpenId(visit.id)}>
                      <span className="adm-row-time tabular">{fmtDate(start)}</span>
                      <span className="grow stack gap-4" style={{ minWidth: 0 }}>
                        <span className="truncate">{visit.items.map((i) => serviceById(i.serviceId)?.name).join(", ")}</span>
                        <span className="muted t-cap truncate">
                          {fmtTime(start)} · {data.staff.find((s) => s.id === visit.staffId)?.name} · {branchById(visit.branchId)?.name}
                        </span>
                      </span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="adm-card hair-record" aria-labelledby="hair-record">
          <div className="adm-card-head">
            <h2 id="hair-record" className="t-title">
              Hair record
            </h2>
            <span className="adm-meta">Staff only</span>
          </div>
          <div className="adm-card-body stack gap-16">
            <label className="field">
              <span>Allergies and sensitivities</span>
              <textarea
                className={record.allergies ? "has-allergy" : ""}
                value={record.allergies ?? ""}
                onChange={(e) => edit({ allergies: e.target.value })}
                rows={2}
                placeholder="Anything to check before a relaxer, colour or treatment"
              />
            </label>
            <label className="field">
              <span>Colour formula</span>
              <input value={record.colourFormula ?? ""} onChange={(e) => edit({ colourFormula: e.target.value })} placeholder="e.g. 6N + 20 vol, 35 min" />
            </label>
            <label className="field">
              <span>
                Last relaxer
                {relaxerDays !== null && relaxerDays >= 0 && <span className="subtle"> · {Math.floor(relaxerDays / 7)} weeks ago</span>}
              </span>
              <input type="date" value={record.lastRelaxer ?? ""} onChange={(e) => edit({ lastRelaxer: e.target.value })} />
            </label>
            <label className="field">
              <span>Prefers</span>
              <select value={record.preferredStaffId ?? ""} onChange={(e) => edit({ preferredStaffId: e.target.value })}>
                <option value="">Anyone</option>
                {branchStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {branchById(s.branchId)?.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Usual branch</span>
              <select value={record.preferredBranchId ?? ""} onChange={(e) => edit({ preferredBranchId: e.target.value })}>
                <option value="">Any</option>
                {BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={record.notes ?? ""}
                onChange={(e) => edit({ notes: e.target.value })}
                rows={4}
                placeholder="Texture, what worked, what didn't, how they like to be spoken to…"
              />
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button variant="dark" block onClick={save} disabled={!dirty}>
              {dirty ? "Save hair record" : "Saved"}
            </Button>
          </div>
        </section>
      </div>

      <VisitSheet visitId={openId} open={openId !== null} onClose={() => setOpenId(null)} />
    </AdminPage>
  );
}
