import { AlertTriangle, ChevronRight, CircleAlert, Inbox, MessageCircle, NotebookPen, Phone, ReceiptText } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { BRANCHES, branchById } from "../../data/business";
import { desk, useAppData } from "../../data/store";
import type { Customer, HairRecord } from "../../data/types";
import { clientRows } from "../../lib/clients";
import { formatGhPhone, telLink, whatsappLink } from "../../lib/contact";
import { dayKey, daysBetween, fmtDate, fmtTime, money, parseLocal, plural } from "../../lib/format";
import { METHOD_LABEL, SOURCE_LABEL } from "../../lib/trends";
import { enter } from "../../motion";
import { useFirstVisit, useNow } from "../hooks";
import { AdminPage, EmptyState } from "../Shell";
import { useVisitActions, VisitCard } from "../visitCard";

type Tab = "visits" | "hair" | "payments";
const TABS: { id: Tab; label: string }[] = [
  { id: "visits", label: "Visits" },
  { id: "hair", label: "Hair record" },
  { id: "payments", label: "Payments" },
];

export function ClientProfile() {
  const { clientId } = useParams();
  const data = useAppData();
  const customer = data.customers.find((c) => c.id === clientId);
  if (!customer) {
    return (
      <AdminPage title="Client not found" back={{ to: "/admin/clients", label: "Clients" }}>
        <EmptyState icon={<CircleAlert size={22} />} title="We couldn't find that client" body="They may have been removed when the demo was reset." action={<Link to="/admin/clients" className="btn btn-dark">All clients</Link>} />
      </AdminPage>
    );
  }
  return <ProfileView customer={customer} />;
}

function ProfileView({ customer }: { customer: Customer }) {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "visits";
  const first = useFirstVisit(`client:${customer.id}`);
  const actions = useVisitActions();
  const row = useMemo(() => clientRows([customer], data.visits, now)[0]!, [customer, data.visits, now]);
  const visits = data.visits.filter((v) => v.customerId === customer.id).sort((a, b) => b.start.localeCompare(a.start));
  const payments = visits.flatMap((v) => v.payments.map((p) => ({ visit: v, payment: p }))).sort((a, b) => b.payment.at.localeCompare(a.payment.at));
  const firstName = customer.name.split(" ")[0];
  const allergy = customer.hair?.allergies;

  return (
    <AdminPage
      title={customer.name}
      back={{ to: "/admin/clients", label: "Clients" }}
      status={
        <>
          <span className="tabular">{formatGhPhone(customer.phone)}</span> · {customer.area || "Area not given"} · {SOURCE_LABEL[customer.source ?? "app"]}
        </>
      }
      actions={
        <>
          <a className="btn btn-outline" href={whatsappLink(customer.phone, `Hello ${firstName}, it's Royal Hair.`)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a className="btn btn-outline" href={telLink(customer.phone)}>
            <Phone size={16} /> Call
          </a>
          <Cta onClick={() => navigate(`/admin/walk-in?client=${customer.id}`)}>Book them in</Cta>
          {/* On phones the header CTA gives way to the tab bar, which doesn't know who this is. */}
          <Link className="btn btn-dark mobile-only" to={`/admin/walk-in?client=${customer.id}`}>
            Book them in
          </Link>
        </>
      }
    >
      {allergy && (
        <p className="allergy-alert" role="alert" style={{ marginBottom: 16, maxWidth: 860 }}>
          <AlertTriangle size={18} strokeWidth={2} />
          <span>
            <b>Check before any relaxer, colour or treatment:</b> {allergy}
          </span>
        </p>
      )}

      <motion.section className="adm-card" style={{ marginBottom: 16 }} {...(first ? enter(16) : {})} aria-label="Summary">
        <div className="adm-card-body" style={{ paddingTop: 20, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={customer.name} size={56} />
          <dl className="adm-kv-grid is-4" style={{ flex: 1, minWidth: 260 }}>
            <div>
              <dt>Paid to date</dt>
              <dd className="big">{money(row.spend)}</dd>
            </div>
            <div>
              <dt>Visits</dt>
              <dd className="big">{row.visits}</dd>
            </div>
            <div>
              <dt>Balance owed</dt>
              <dd className="big" style={row.owed > 0 ? { color: "var(--warning-ink)" } : undefined}>
                {money(row.owed)}
              </dd>
            </div>
            <div>
              <dt>Client since</dt>
              <dd className="big">{fmtDate(new Date(customer.memberSince)).replace(/^\d+ /, "")}</dd>
            </div>
          </dl>
        </div>
        {row.dueBack && (
          <p className="adm-card-foot t-cap" style={{ justifyContent: "flex-start" }}>
            Due back for their usual service {row.dueBack <= dayKey(now) ? "since" : "on"} {fmtDate(parseLocal(row.dueBack))}. Nothing is booked yet.
          </p>
        )}
      </motion.section>

      <div className="segmented" role="tablist" aria-label="Client details" style={{ maxWidth: 520, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setParams(t.id === "visits" ? {} : { tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "visits" &&
          (visits.length ? (
            <div className="res-list" style={{ maxWidth: 860 }}>
              {visits.map((v) => (
                <VisitCard key={v.id} visit={v} customer={customer} now={now} onOpen={actions.open} onStep={actions.run} showClient={false} />
              ))}
            </div>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<Inbox size={22} />} title="No visits yet" action={<Link className="btn btn-dark" to={`/admin/walk-in?client=${customer.id}`}>Book them in</Link>} />
            </div>
          ))}

        {tab === "hair" && <HairRecordCard key={customer.id} customer={customer} />}

        {tab === "payments" &&
          (payments.length ? (
            <section className="adm-card" style={{ maxWidth: 860 }}>
              <div className="adm-rows" style={{ paddingBlock: 4 }}>
                {payments.map(({ visit, payment }) => (
                  <Link key={payment.id} to={`/admin/visits/${visit.id}/receipts/${payment.id}`} className="adm-row">
                    <span className="row-icon">
                      <ReceiptText size={18} strokeWidth={1.7} />
                    </span>
                    <span className="grow stack">
                      <span>
                        {visit.number} · {METHOD_LABEL[payment.method]}
                      </span>
                      <span className="t-cap muted">
                        <span className="t-mono">{payment.receiptNo}</span> · {fmtDate(new Date(payment.at))}, {fmtTime(new Date(payment.at))}
                      </span>
                    </span>
                    <span className="tabular" style={{ fontWeight: 500 }}>
                      {money(payment.amount)}
                    </span>
                    <ChevronRight size={18} className="row-chevron" />
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<ReceiptText size={22} />} title="No payments yet" />
            </div>
          ))}
      </div>
      {actions.sheets}
    </AdminPage>
  );
}

/** What the stylist needs before the client sits down. Only staff see it. */
function HairRecordCard({ customer }: { customer: Customer }) {
  const data = useAppData();
  const notify = useNotify();
  const now = useNow();
  const saved = customer.hair ?? {};
  const [record, setRecord] = useState<HairRecord>(() => ({ ...saved }));
  const [error, setError] = useState<string | null>(null);
  // Follow the saved record when it changes elsewhere (a new booking can add an allergy),
  // so a save from this form never writes back an older version.
  const savedKey = JSON.stringify(saved);
  const [base, setBase] = useState(savedKey);
  if (base !== savedKey) {
    setBase(savedKey);
    setRecord({ ...saved });
  }
  const keys: (keyof HairRecord)[] = ["allergies", "colourFormula", "lastRelaxer", "preferredStaffId", "preferredBranchId", "notes"];
  const dirty = keys.some((k) => (record[k] ?? "").trim() !== (saved[k] ?? ""));
  const relaxerWeeks = record.lastRelaxer ? Math.floor(daysBetween(parseLocal(record.lastRelaxer), now) / 7) : null;
  const edit = (patch: Partial<HairRecord>) => setRecord((current) => ({ ...current, ...patch }));

  const save = () => {
    const result = desk.saveHairRecord(customer.id, record);
    if ("error" in result) return setError(result.error);
    setError(null);
    notify("Hair record saved", `${customer.name}'s record is up to date.`);
  };

  return (
    <section className="adm-card" style={{ maxWidth: 760 }} aria-labelledby="hair-record">
      <div className="adm-card-head">
        <h2 id="hair-record" className="inline" style={{ gap: 8 }}>
          <NotebookPen size={17} /> Hair record
        </h2>
        <span className="adm-meta">Only staff see this</span>
      </div>
      <div className="adm-card-body stack gap-16">
        <div className="field">
          <label htmlFor="hair-allergies">Allergies and sensitivities</label>
          <textarea id="hair-allergies" className={record.allergies ? "has-allergy" : ""} rows={2} maxLength={400} value={record.allergies ?? ""} onChange={(e) => edit({ allergies: e.target.value })} placeholder="Anything to check before a relaxer, colour or treatment" />
        </div>
        <div className="settings-grid">
          <div className="field">
            <label htmlFor="hair-formula">Colour formula</label>
            <input id="hair-formula" maxLength={120} value={record.colourFormula ?? ""} onChange={(e) => edit({ colourFormula: e.target.value })} placeholder="e.g. 6N + 20 vol, 35 min" />
          </div>
          <div className="field">
            <label htmlFor="hair-relaxer">Last relaxer</label>
            <input id="hair-relaxer" type="date" value={record.lastRelaxer ?? ""} onChange={(e) => edit({ lastRelaxer: e.target.value })} />
            {relaxerWeeks !== null && relaxerWeeks >= 0 && <span className="hint">{plural(relaxerWeeks, "week")} ago</span>}
          </div>
          <div className="field">
            <label htmlFor="hair-staff">Likes to see</label>
            <select id="hair-staff" value={record.preferredStaffId ?? ""} onChange={(e) => edit({ preferredStaffId: e.target.value })}>
              <option value="">Anyone free</option>
              {data.staff
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {branchById(s.branchId)?.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hair-branch">Usual branch</label>
            <select id="hair-branch" value={record.preferredBranchId ?? ""} onChange={(e) => edit({ preferredBranchId: e.target.value })}>
              <option value="">Any</option>
              {BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="hair-notes">Notes</label>
          <textarea id="hair-notes" rows={5} maxLength={4000} value={record.notes ?? ""} onChange={(e) => edit({ notes: e.target.value })} placeholder={`Notes for ${customer.name.split(" ")[0]}: texture, scalp, what worked and what didn't, how they like their edges…`} />
        </div>
        <div className="between">
          <span className="t-cap muted">{plural((record.notes ?? "").length, "character")} of 4,000</span>
          <Button variant="dark" disabled={!dirty} onClick={save}>
            Save hair record
          </Button>
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
