import { Check, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { BRANCHES, branchById } from "../../data/business";
import { GROUP_LABEL, SERVICES, serviceById } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { PaymentMethod, Service, VisitSource } from "../../data/types";
import { findClash, staffFor } from "../../lib/booking";
import { formatGhPhone, normalizeGhPhone } from "../../lib/contact";
import { fmtDayShort, fmtTime, localIso, money, parseLocal } from "../../lib/format";
import { durationLabel, priceLabel } from "../../lib/pricing";
import { concreteBranchId, useBranchScope } from "../branch";
import { AdminPage } from "../Shell";

const SOURCES: { id: VisitSource; label: string }[] = [
  { id: "walkin", label: "Walked in" },
  { id: "phone", label: "Phoned" },
  { id: "whatsapp", label: "WhatsApp" },
];

/** Walk-ins start at the next five-minute mark, so "now" is never already in the past. */
function nextFiveMinutes(now: Date): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil((next.getMinutes() + 1) / 5) * 5);
  return next;
}

/**
 * The commonest job at the desk, so it is built to be quick: services, then who is free, then the
 * client. A slow walk-in form gets abandoned for the paper book on day two.
 */
export function WalkIn() {
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const scope = useBranchScope();

  const [branchId, setBranchId] = useState(() => {
    const requested = params.get("branch");
    return requested && branchById(requested) ? requested : concreteBranchId(scope);
  });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(params.get("staff") ?? "");
  const fixedStart = params.get("start");
  const [source, setSource] = useState<VisitSource>(fixedStart ? "phone" : "walkin");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState(() => params.get("client") ?? "");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState("");

  const start = fixedStart ?? localIso(nextFiveMinutes(new Date()));
  const chosen = serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));
  const minutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const eligible = staffFor(data.staff, branchId, chosen);

  /** Who can take this right now, without clashing with anyone's diary. */
  const freeNow = useMemo(() => {
    const span = { start: parseLocal(start), end: new Date(parseLocal(start).getTime() + Math.max(minutes, 15) * 60_000) };
    return new Set(eligible.filter((s) => !findClash(data.visits, s.id, span)).map((s) => s.id));
  }, [eligible, data.visits, start, minutes]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    const digits = needle.replace(/\D/g, "");
    return data.customers
      .filter((c) => c.name.toLowerCase().includes(needle) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 5);
  }, [data.customers, query]);

  const toggle = (id: string) => setServiceIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const submit = () => {
    if (!chosen.length) return setError("Choose at least one service.");
    if (!staffId) return setError("Choose who is doing it.");
    const result = desk.create({
      branchId,
      staffId,
      serviceIds,
      start,
      source,
      customerId: customerId || undefined,
      newClient: customerId ? undefined : { name: newName, phone: newPhone, source: source === "walkin" ? "walkin" : "referral" },
      payment: payNow ? { amount: total, method } : undefined,
    });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const staff = data.staff.find((s) => s.id === staffId);
    notify(source === "walkin" ? "Walk-in added" : "Booking added", `${staff?.name ?? "Staff"} at ${fmtTime(parseLocal(start))}.`);
    navigate(source === "walkin" ? "/admin" : "/admin/diary");
  };

  const selectedClient = data.customers.find((c) => c.id === customerId);

  return (
    <AdminPage
      title={fixedStart ? "New booking" : "Add walk-in"}
      back={{ to: fixedStart ? "/admin/diary" : "/admin", label: fixedStart ? "Diary" : "Today" }}
      status={`${fmtDayShort(parseLocal(start))} at ${fmtTime(parseLocal(start))}`}
    >
      <div className="walkin">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">1 · Services</h2>
            {BRANCHES.filter((b) => b.active).length > 1 && (
              <select className="adm-input walkin-branch" value={branchId} onChange={(e) => { setBranchId(e.target.value); setStaffId(""); }} aria-label="Branch">
                {BRANCHES.filter((b) => b.active).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="adm-card-body stack gap-12">
            {(["hair", "barbering", "nails", "spa", "kids"] as const).map((group) => (
              <div key={group} className="stack gap-8">
                <p className="adm-meta">{GROUP_LABEL[group]}</p>
                <div className="walkin-chips">
                  {SERVICES.filter((s) => s.group === group && s.active !== false).map((service) => {
                    const picked = serviceIds.includes(service.id);
                    return (
                      <button key={service.id} className={`chip ${picked ? "is-active" : ""}`} onClick={() => toggle(service.id)} aria-pressed={picked}>
                        {picked && <Check size={14} strokeWidth={2.2} />}
                        {service.name}
                        <span className="subtle">{priceLabel(service)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">2 · Who does it</h2>
            {minutes > 0 && <span className="adm-meta">{durationLabel(minutes)}</span>}
          </div>
          <div className="adm-card-body">
            {!chosen.length ? (
              <p className="muted">Pick a service first. Only staff who do it are shown.</p>
            ) : eligible.length === 0 ? (
              <p className="muted">Nobody at this branch covers all of those. Split it into two visits.</p>
            ) : (
              <div className="walkin-staff">
                {eligible.map((member) => {
                  const free = freeNow.has(member.id);
                  return (
                    <button
                      key={member.id}
                      className={`select-card ${staffId === member.id ? "is-selected" : ""}`}
                      onClick={() => setStaffId(member.id)}
                      disabled={!free}
                      aria-pressed={staffId === member.id}
                    >
                      <span className="grow stack gap-4">
                        <span className="t-title">{member.name}</span>
                        <span className={`t-cap ${free ? "is-open" : "subtle"}`}>{free ? "Free" : "Busy then"}</span>
                      </span>
                      {staffId === member.id && <Check size={18} strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="t-title">3 · The client</h2>
          </div>
          <div className="adm-card-body stack gap-12">
            <div className="segmented" role="group" aria-label="How they booked">
              {SOURCES.map((s) => (
                <button key={s.id} className={source === s.id ? "is-active" : ""} onClick={() => setSource(s.id)} aria-pressed={source === s.id}>
                  {s.label}
                </button>
              ))}
            </div>

            {selectedClient ? (
              <div className="select-card is-selected">
                <span className="grow stack gap-4">
                  <span className="t-title">{selectedClient.name}</span>
                  <span className="muted t-cap">{formatGhPhone(selectedClient.phone)}</span>
                  {selectedClient.hair?.allergies && <span className="t-cap" style={{ color: "var(--danger)" }}>Allergy: {selectedClient.hair.allergies}</span>}
                </span>
                <button className="link hit" onClick={() => setCustomerId("")}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <label className="rh-search">
                  <Search size={17} strokeWidth={1.8} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Returning client? Name or phone" aria-label="Find a returning client" />
                </label>
                {matches.length > 0 && (
                  <div className="list-card">
                    {matches.map((c) => (
                      <button key={c.id} className="row" onClick={() => { setCustomerId(c.id); setQuery(""); }}>
                        <span className="grow stack gap-4">
                          <span>{c.name}</span>
                          <span className="subtle t-cap">{formatGhPhone(c.phone)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="adm-meta inline gap-8">
                  <UserPlus size={14} /> Or a new client
                </p>
                <div className="walkin-new">
                  <label className="field">
                    <span>Name</span>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
                  </label>
                  <label className="field">
                    <span>WhatsApp number</span>
                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" placeholder="024 123 4567" aria-invalid={Boolean(newPhone) && !normalizeGhPhone(newPhone)} />
                  </label>
                </div>
              </>
            )}

            <label className="check-row">
              <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
              <span className="muted">They're paying the full {money(total)} now</span>
            </label>
            {payNow && (
              <div className="segmented" role="group" aria-label="Payment method">
                {(["cash", "momo", "card"] as const).map((m) => (
                  <button key={m} className={method === m ? "is-active" : ""} onClick={() => setMethod(m)} aria-pressed={method === m}>
                    {m === "momo" ? "MoMo" : m[0]!.toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="walkin-bar">
          <div className="stack gap-4">
            <strong className="tabular">{money(total)}</strong>
            <span className="adm-meta">{chosen.length ? `${chosen.length} service${chosen.length > 1 ? "s" : ""} · ${durationLabel(minutes)}` : "No services yet"}</span>
          </div>
          <div className="inline gap-8">
            <Button className="walkin-cancel" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Cta onClick={submit}>{source === "walkin" ? "Seat them" : "Book it"}</Cta>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
