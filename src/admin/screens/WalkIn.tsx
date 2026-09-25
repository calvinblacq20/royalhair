import { AlertTriangle, Check } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { SuccessScreen } from "../../components/Overlays";
import { BRANCHES, branchById } from "../../data/business";
import { GROUPS } from "../../data/catalog";
import { desk, useAppData } from "../../data/store";
import type { LeadSource, PaymentMethod, Service, VisitSource } from "../../data/types";
import { findClash, staffFor, staffWorksOn } from "../../lib/booking";
import { formatGhPhone, normalizeGhPhone } from "../../lib/contact";
import { dayKey, fmtDayShort, fmtTime, localIso, money, parseLocal } from "../../lib/format";
import { durationLabel, priceLabel } from "../../lib/pricing";
import { SOURCE_LABEL } from "../../lib/trends";
import { concreteBranchId, useBranchScope } from "../branch";
import { CardHead } from "../controls";
import { Dropdown } from "../Dropdown";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";

const SOURCES: { id: VisitSource; label: string }[] = [
  { id: "walkin", label: "Walked in" },
  { id: "phone", label: "Phoned" },
  { id: "whatsapp", label: "WhatsApp" },
];
const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "momo", label: "MoMo" },
  { id: "card", label: "Card" },
];
const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));

/** Walk-ins start at the next five-minute mark, so "now" is never already in the past. */
function nextFiveMinutes(now: Date): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil((next.getMinutes() + 1) / 5) * 5);
  return next;
}

/**
 * The commonest job at the desk, so it is built to be quick: the client, the services, who is
 * free, then money. A slow walk-in form gets abandoned for the paper book on day two.
 */
export function WalkIn() {
  const data = useAppData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scope = useBranchScope();
  const preset = data.customers.find((c) => c.id === params.get("client"));
  const fixedStart = params.get("start");

  const [branchId, setBranchId] = useState(() => {
    const requested = params.get("branch");
    return requested && branchById(requested) ? requested : concreteBranchId(scope);
  });
  const [mode, setMode] = useState<"existing" | "new">(preset ? "existing" : "new");
  const [clientId, setClientId] = useState<string | undefined>(preset?.id);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState({ name: "", phone: "", area: "", source: "walkin" as LeadSource });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(params.get("staff") ?? "");
  const [source, setSource] = useState<VisitSource>(fixedStart ? "phone" : "walkin");
  const [notes, setNotes] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ walkIn: boolean } | null>(null);
  const now = useNow();
  // Phone and WhatsApp bookings can be for later; a walk-in is always the next five minutes.
  const [when, setWhen] = useState(() => {
    const [date = "", time = ""] = localIso(nextFiveMinutes(new Date())).split("T");
    return { date, time };
  });
  const startFor = (at: Date) => fixedStart ?? (source === "walkin" ? localIso(nextFiveMinutes(at)) : `${when.date}T${when.time}`);
  const start = startFor(now);

  const startDate = useMemo(() => parseLocal(start), [start]);
  const chosen = useMemo(() => serviceIds.map((id) => data.services.find((s) => s.id === id)).filter((s): s is Service => Boolean(s)), [serviceIds, data.services]);
  const minutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const paying = payNow ? (amountTouched ? toNumber(amount) : total) : 0;
  const branches = BRANCHES.filter((b) => b.active);
  const person = data.customers.find((c) => c.id === clientId);
  const eligible = useMemo(() => staffFor(data.staff, branchId, chosen).filter((s) => staffWorksOn(s, startDate)), [data.staff, branchId, chosen, startDate]);
  const staff = data.staff.find((s) => s.id === staffId);

  /** Who can take this at the start time without clashing with anyone's diary. */
  const free = useMemo(() => {
    const span = { start: startDate, end: new Date(startDate.getTime() + Math.max(minutes, 15) * 60_000) };
    return new Set(eligible.filter((s) => !findClash(data.visits, s.id, span)).map((s) => s.id));
  }, [eligible, data.visits, startDate, minutes]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    return data.customers
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && (normalizeGhPhone(c.phone) ?? "").includes(digits)))
      .slice(0, 6);
  }, [data.customers, search]);

  const toggle = (id: string) => {
    setServiceIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));
    setError(null);
  };

  const done = useCallback(() => {
    if (saved) navigate(saved.walkIn ? "/admin" : "/admin/diary", { replace: true });
  }, [saved, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "existing" && !person) return setError("Choose the client, or switch to a new client.");
    if (!chosen.length) return setError("Choose at least one service.");
    if (!staffId || !eligible.some((s) => s.id === staffId)) return setError("Choose who is doing it.");
    if (payNow && (paying <= 0 || paying > total)) return setError(`Enter an amount between GH₵ 1 and ${money(total)}.`);
    if (!fixedStart && source !== "walkin" && (!when.date || !when.time)) return setError("Choose the day and time they're coming.");
    const result = desk.create({
      branchId,
      staffId,
      serviceIds,
      // Worked out again now: the form may have been open a while, and "in five minutes" moves with the clock.
      start: startFor(new Date()),
      source,
      customerId: mode === "existing" ? person?.id : undefined,
      newClient: mode === "new" ? client : undefined,
      notes,
      payment: payNow ? { amount: paying, method, reference } : undefined,
    });
    if ("error" in result) return setError(result.error);
    setError(null);
    setSaved({ walkIn: source === "walkin" });
  };

  const summary = (
    <section className="adm-card" aria-labelledby="summary">
      <CardHead id="summary" title="Summary" />
      <div className="adm-card-body stack gap-12">
        <div className="kv">
          <span className="muted">Client</span>
          <span className="truncate" style={{ maxWidth: "60%" }}>
            {mode === "existing" ? (person?.name ?? "Not chosen") : client.name || "New client"}
          </span>
        </div>
        <div className="kv">
          <span className="muted">When</span>
          <span>
            {fmtDayShort(startDate)}, {fmtTime(startDate)}
          </span>
        </div>
        <div className="kv">
          <span className="muted">With</span>
          <span className="truncate" style={{ maxWidth: "60%" }}>
            {staff ? `${staff.name} · ${branchById(branchId)?.name}` : "Not chosen"}
          </span>
        </div>
        {chosen.length > 0 && <div className="divider" style={{ margin: 0 }} />}
        {chosen.map((s) => (
          <div key={s.id} className="kv">
            <span>{s.name}</span>
            <span>{priceLabel(s)}</span>
          </div>
        ))}
        <div className="divider" style={{ margin: 0 }} />
        <div className="kv kv-total">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
        {payNow && paying > 0 && (
          <>
            <div className="kv muted">
              <span>Paid today</span>
              <span>{money(paying)}</span>
            </div>
            <div className="kv" style={{ fontWeight: 500 }}>
              <span>Left to pay</span>
              <span>{money(Math.max(0, total - paying))}</span>
            </div>
          </>
        )}
        <div className="kv muted">
          <span>Takes</span>
          <span>{minutes ? durationLabel(minutes) : "–"}</span>
        </div>
        {error && (
          <p className="adm-form-error desktop-only" role="alert">
            {error}
          </p>
        )}
        <Cta type="submit" className="desktop-only">
          {source === "walkin" ? "Seat them" : "Save booking"}
        </Cta>
      </div>
    </section>
  );

  return (
    <AdminPage
      title={fixedStart ? "New booking" : "Add walk-in"}
      back={{ to: fixedStart ? "/admin/diary" : "/admin", label: fixedStart ? "Diary" : "Today" }}
      status={<>For walk-ins, and bookings taken by phone or WhatsApp</>}
    >
      <form className="adm-detail" onSubmit={submit} noValidate>
        <div className="adm-stack">
          <section className="adm-card" aria-labelledby="who">
            <CardHead
              id="who"
              title="Client"
              action={
                <div className="segmented" role="radiogroup" aria-label="Client type" style={{ width: 220 }}>
                  <button type="button" role="radio" aria-checked={mode === "existing"} className={mode === "existing" ? "is-active" : ""} onClick={() => setMode("existing")}>
                    Returning
                  </button>
                  <button type="button" role="radio" aria-checked={mode === "new"} className={mode === "new" ? "is-active" : ""} onClick={() => setMode("new")}>
                    New client
                  </button>
                </div>
              }
            />
            <div className="adm-card-body stack gap-12">
              {mode === "existing" ? (
                person ? (
                  <>
                    <div className="select-card is-selected" style={{ alignItems: "center", boxShadow: "none" }}>
                      <Avatar name={person.name} size={40} />
                      <span className="grow stack">
                        <span style={{ fontWeight: 500 }}>{person.name}</span>
                        <span className="t-cap muted">
                          {formatGhPhone(person.phone)}
                          {person.area ? ` · ${person.area}` : ""}
                        </span>
                      </span>
                      <Button type="button" size="sm" onClick={() => setClientId(undefined)}>
                        Change
                      </Button>
                    </div>
                    {person.hair?.allergies && (
                      <p className="allergy-alert" role="alert">
                        <AlertTriangle size={18} strokeWidth={2} />
                        <span>
                          <b>Check before starting:</b> {person.hair.allergies}
                        </span>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <input className="adm-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" aria-label="Search clients" />
                    <div className="stack gap-8" role="listbox" aria-label="Matching clients">
                      {matches.map((c) => (
                        <button key={c.id} type="button" role="option" aria-selected={false} className="select-card" style={{ alignItems: "center", background: "var(--ground)", boxShadow: "none", padding: 12 }} onClick={() => setClientId(c.id)}>
                          <Avatar name={c.name} size={34} soft />
                          <span className="grow stack">
                            <span>{c.name}</span>
                            <span className="t-cap muted">
                              {formatGhPhone(c.phone)}
                              {c.area ? ` · ${c.area}` : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                      {matches.length === 0 && <p className="muted">No client with that name or number. Switch to New client.</p>}
                    </div>
                  </>
                )
              ) : (
                <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                  <div className="field">
                    <label htmlFor="nc-name">Full name</label>
                    <input id="nc-name" value={client.name} maxLength={80} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-phone">WhatsApp number</label>
                    <input id="nc-phone" type="tel" inputMode="tel" value={client.phone} maxLength={20} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="024 123 4567" autoComplete="off" aria-invalid={Boolean(client.phone) && !normalizeGhPhone(client.phone)} />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-area">Area (optional)</label>
                    <input id="nc-area" value={client.area} maxLength={60} onChange={(e) => setClient({ ...client, area: e.target.value })} placeholder="e.g. Weija" />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-source">Found the salon through</label>
                    <Dropdown<LeadSource> id="nc-source" variant="field" value={client.source} onChange={(s) => setClient({ ...client, source: s })} options={(["walkin", "instagram", "tiktok", "referral"] as const).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="services-h">
            <CardHead
              id="services-h"
              title="Services"
              action={
                branches.length > 1 ? (
                  <Dropdown
                    label="Branch"
                    value={branchId}
                    align="end"
                    onChange={(id) => {
                      setBranchId(id);
                      setStaffId("");
                    }}
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  />
                ) : undefined
              }
            />
            <div className="adm-card-body stack gap-16">
              {GROUPS.map((group) => {
                const list = data.services.filter((s) => s.group === group.id && s.active !== false);
                if (!list.length) return null;
                return (
                  <fieldset key={group.id} className="stack gap-8" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="adm-meta" style={{ marginBottom: 8 }}>
                      {group.label}
                    </legend>
                    <div className="walkin-chips">
                      {list.map((service) => {
                        const picked = serviceIds.includes(service.id);
                        return (
                          <button key={service.id} type="button" className={`chip ${picked ? "is-active" : ""}`} onClick={() => toggle(service.id)} aria-pressed={picked}>
                            {picked && <Check size={14} strokeWidth={2.2} />}
                            {service.name}
                            <span className="subtle">{priceLabel(service)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="with-h">
            <CardHead
              id="with-h"
              title="Who does it"
              action={
                <span className="adm-meta">
                  {fmtDayShort(startDate)} at {fmtTime(startDate)}
                  {minutes ? ` · ${durationLabel(minutes)}` : ""}
                </span>
              }
            />
            <div className="adm-card-body">
              {!chosen.length ? (
                <p className="muted">Pick a service first. Only staff who do it, and who work that day, are shown.</p>
              ) : eligible.length === 0 ? (
                <p className="muted">Nobody at this branch who works that day covers all of those. Try another day, or split it into two visits.</p>
              ) : (
                <div className="walkin-staff" role="radiogroup" aria-label="Staff">
                  {eligible.map((member) => {
                    const isFree = free.has(member.id);
                    const picked = staffId === member.id;
                    return (
                      <button key={member.id} type="button" role="radio" aria-checked={picked} className={`select-card ${picked ? "is-selected" : ""}`} onClick={() => setStaffId(member.id)} disabled={!isFree} style={{ alignItems: "center", boxShadow: "none", background: picked ? undefined : "var(--ground)" }}>
                        <Avatar name={member.name} size={34} soft />
                        <span className="grow stack">
                          <span style={{ fontWeight: 500 }}>{member.name}</span>
                          <span className="t-cap" style={{ color: isFree ? "var(--open)" : "var(--ink-62)" }}>
                            {isFree ? "Free" : "Busy then"}
                          </span>
                        </span>
                        {picked && <Check size={18} strokeWidth={2} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="money-h">
            <CardHead id="money-h" title="How they booked and payment" />
            <div className="adm-card-body stack gap-16">
              <div className="segmented" role="radiogroup" aria-label="How they booked" style={{ maxWidth: 420 }}>
                {SOURCES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={source === s.id} className={source === s.id ? "is-active" : ""} onClick={() => setSource(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              {!fixedStart && source !== "walkin" && (
                <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                  <div className="field">
                    <label htmlFor="walkin-date">Day</label>
                    <input id="walkin-date" type="date" min={dayKey(now)} value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="walkin-time">Time</label>
                    <input id="walkin-time" type="time" step={900} value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="field">
                <label htmlFor="walkin-note">Note for the stylist (optional)</label>
                <input id="walkin-note" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Length, colour, a reference photo on WhatsApp" />
              </div>
              <label className="check-row">
                <input type="checkbox" className="cbx" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
                <span>Paid today</span>
              </label>
              {payNow && (
                <div className="adm-grid adm-grid-3" style={{ gap: 16, alignItems: "end" }}>
                  <div className="field">
                    <label htmlFor="walkin-amount">Amount (GH₵)</label>
                    <input
                      id="walkin-amount"
                      inputMode="decimal"
                      value={amountTouched ? amount : String(total || "")}
                      onChange={(e) => {
                        setAmountTouched(true);
                        setAmount(e.target.value);
                      }}
                    />
                  </div>
                  <div className="segmented" role="radiogroup" aria-label="Paid by">
                    {METHODS.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className={method === m.id ? "is-active" : ""} onClick={() => setMethod(m.id)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {method !== "cash" ? (
                    <div className="field">
                      <label htmlFor="walkin-ref">{method === "momo" ? "MoMo transaction ID" : "Reference"} (optional)</label>
                      <input id="walkin-ref" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} />
                    </div>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="adm-detail-aside">{summary}</aside>

        {error && (
          <p className="adm-form-error mobile-only" role="alert">
            {error}
          </p>
        )}
        <div className="sticky-bar mobile-only" style={{ bottom: "calc(84px + var(--safe-bottom))", borderRadius: 16, margin: "0 0 8px" }}>
          <span className="sticky-bar-meta">
            <strong>{money(total)}</strong>
            <span className="t-cap muted">{chosen.length ? `${durationLabel(minutes)}${staff ? ` · ${staff.name.split(" ")[0]}` : ""}` : "No services yet"}</span>
          </span>
          <Button variant="dark" type="submit" icon={<Check size={16} />}>
            {source === "walkin" ? "Seat them" : "Save"}
          </Button>
        </div>
      </form>
      <SuccessScreen open={saved !== null} title={saved?.walkIn ? "Seated" : "Booking saved"} onDone={done} />
    </AdminPage>
  );
}
