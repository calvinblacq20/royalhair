import { Check, MapPin, Shuffle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopBar } from "../components/Chrome";
import { Avatar } from "../components/Bits";
import { Cta } from "../components/Button";
import { useNotify } from "../components/Notify";
import { PaystackSheet } from "../components/Paystack";
import { DateStrip } from "../components/Pickers";
import { SuccessScreen } from "../components/Overlays";
import { BRANCHES, POLICIES, SALON } from "../data/business";
import { GROUP_LABEL, ROLE_LABEL, SERVICES, serviceById } from "../data/catalog";
import { accessOf, actions, useAppData, type OnlinePayment } from "../data/store";
import type { Service, ServiceGroup, Staff } from "../data/types";
import { availabilityFor, leastBusy, openingOn, slotsFor, staffFor } from "../lib/booking";
import { canViewVisit, cleanContact, contactFromCustomer, EMPTY_CONTACT, validateContact, type ContactErrors } from "../lib/checkout";
import { addDays, dayKey, fmtDayShort, fmtTime, money, parseLocal, startOfDay } from "../lib/format";
import { depositFor, durationLabel, priceLabel } from "../lib/pricing";

const STEPS = ["Branch", "Services", "Time", "Details"] as const;
const DAYS_AHEAD = 21;
/** Quarter-hour starts: a shape-up is 15 minutes and a cut is 30, so half-hour slots would waste the barber's day. */
const SLOT_OPTIONS = { stepMinutes: 15 };
/** Services that touch the scalp with chemicals, where an allergy has to be known before starting. */
const CHEMICAL = new Set(["s-perm", "s-colour", "s-dye"]);
const GROUP_ORDER: ServiceGroup[] = ["hair", "barbering", "nails", "spa", "kids"];
/** "Whoever is free" spreads work across the floor instead of piling it on one stylist. */
const ANY = "any";

export function BookFlow() {
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const account = data.customers.find((c) => c.id === data.session.customerId) ?? null;
  // "Book again" from a past visit: same branch, same services, same barber. Only for visits this phone can see.
  const [rebookFrom] = useState(() => {
    const id = params.get("rebook");
    const visit = id ? data.visits.find((v) => v.id === id) : undefined;
    return visit && canViewVisit(visit, accessOf(data)) ? visit : undefined;
  });
  const [step, setStep] = useState(rebookFrom ? 2 : 0);
  const [branchId, setBranchId] = useState(() => rebookFrom?.branchId ?? data.device.branchId ?? account?.hair?.preferredBranchId ?? BRANCHES[0]!.id);
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    if (rebookFrom) return rebookFrom.items.map((i) => i.serviceId).filter((id) => serviceById(id)?.bookable);
    const requested = params.get("service");
    return requested && serviceById(requested)?.bookable ? [requested] : [];
  });
  const [staffChoice, setStaffChoice] = useState<string>(() => rebookFrom?.staffId ?? account?.hair?.preferredStaffId ?? ANY);
  const [allergies, setAllergies] = useState("");
  const [groupFilter, setGroupFilter] = useState<ServiceGroup | "all">(() => {
    const requested = params.get("service");
    return (requested && serviceById(requested)?.group) || "all";
  });
  const [dayKeyValue, setDayKeyValue] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const [contact, setContact] = useState(() => (account ? contactFromCustomer(account) : data.device.contact ?? EMPTY_CONTACT));
  const [remember, setRemember] = useState(true);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [formError, setFormError] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const branch = BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0]!;
  const chosen = serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));
  const minutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const deposit = depositFor(total, POLICIES.depositRate);

  const eligible = useMemo(() => staffFor(data.staff, branchId, chosen), [data.staff, branchId, chosen]);
  const needsAllergyCheck = chosen.some((s) => CHEMICAL.has(s.id));
  const end = start ? new Date(parseLocal(start).getTime() + minutes * 60_000) : null;

  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(startOfDay(now), i)), [now]);
  const selectedDay = dayKeyValue ? parseLocal(dayKeyValue) : null;

  // Whoever is free: availability is the union of everyone's slots; a named stylist gets their own.
  const availability = useMemo(() => {
    if (!selectedDay || !minutes) return [];
    return availabilityFor({ branch, staff: eligible, day: selectedDay, minutes, visits: data.visits, now }, SLOT_OPTIONS);
  }, [branch, eligible, selectedDay, minutes, data.visits, now]);

  const slots = useMemo(() => {
    if (!selectedDay || !minutes) return [];
    if (staffChoice === ANY) return [...new Set(availability.flatMap((a) => a.slots))].sort();
    const staff = eligible.find((s) => s.id === staffChoice);
    return staff ? slotsFor({ branch, staff, day: selectedDay, minutes, visits: data.visits, now }, SLOT_OPTIONS) : [];
  }, [availability, staffChoice, eligible, branch, selectedDay, minutes, data.visits, now]);

  useEffect(() => {
    if (staffChoice !== ANY && !eligible.some((s) => s.id === staffChoice)) setStaffChoice(ANY);
  }, [eligible, staffChoice]);

  // A day that no longer has the chosen slot (someone else booked it) must not stay selected.
  useEffect(() => {
    if (start && !slots.includes(start)) setStart("");
  }, [slots, start]);

  const toggleService = (id: string) => {
    setServiceIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));
    setStart("");
  };

  /** Who actually takes the booking: the named stylist, or the one with the lightest day. */
  const resolveStaff = (): Staff | null => {
    if (staffChoice !== ANY) return eligible.find((s) => s.id === staffChoice) ?? null;
    const free = availability.filter((a) => a.slots.includes(start)).map((a) => a.staff);
    return selectedDay ? leastBusy(free, data.visits, selectedDay) : null;
  };

  const canContinue = [Boolean(branchId), chosen.length > 0, Boolean(start), true][step];

  const submit = (payment?: OnlinePayment) => {
    const cleaned = cleanContact(contact);
    const found = validateContact(cleaned);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError("Check the highlighted fields.");
      return "Check the highlighted fields.";
    }
    const staff = resolveStaff();
    if (!staff) {
      setFormError("That time has just gone. Please pick another slot.");
      setStep(2);
      return "That time has just gone.";
    }
    const result = actions.book({ branchId, staffId: staff.id, serviceIds, start, contact: cleaned, remember, notes, allergies: needsAllergyCheck ? allergies : undefined, payment });
    if ("error" in result) {
      setFormError(result.error);
      // A slot clash sends them back to pick again rather than leaving them stuck.
      if (result.error.includes("just booked") || result.error.includes("passed")) setStep(2);
      return result.error;
    }
    setFormError("");
    notify(
      "Booking received",
      `${staff.name} at ${branch.name}, ${fmtDayShort(parseLocal(start))} at ${fmtTime(parseLocal(start))}.`,
    );
    setDone(result.visit.id);
    return null;
  };

  if (done) {
    return (
      <SuccessScreen
        open
        title="You're booked"
        onDone={() => navigate(`/visits/${done}`, { replace: true })}
      />
    );
  }

  return (
    <main className="screen flow-screen">
      <TopBar back={step === 0 ? () => navigate(-1) : () => setStep((s) => s - 1)} title={STEPS[step]} alwaysSolid backRow="Back" />

      <div className="flow-progress" aria-hidden="true">
        {STEPS.map((label, i) => (
          <span key={label}>
            <i style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
          </span>
        ))}
      </div>

      {step === 0 && (
        <section className="stack gap-16">
          <h1 className="t-h2">Which branch?</h1>
          <p className="muted">Pick where you'd like to come. You can change it later without losing your basket.</p>
          <div className="stack gap-8">
            {BRANCHES.filter((b) => b.active).map((option) => {
              const hours = openingOn(option, now);
              return (
                <button
                  key={option.id}
                  className={`select-card ${option.id === branchId ? "is-selected" : ""}`}
                  onClick={() => {
                    setBranchId(option.id);
                    setStaffChoice(ANY);
                    setStart("");
                  }}
                  aria-pressed={option.id === branchId}
                >
                  <span className="row-icon" aria-hidden="true">
                    <MapPin size={18} strokeWidth={1.8} />
                  </span>
                  <span className="grow stack gap-4">
                    <span className="t-title">{option.name}</span>
                    <span className="muted t-cap">{option.address}</span>
                    <span className="subtle t-cap">{hours ? `Today ${fmtTime(hours.start)}–${fmtTime(hours.end)}` : "Closed today"}</span>
                  </span>
                  {option.id === branchId && <Check size={18} strokeWidth={2} />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="stack gap-16">
          <h1 className="t-h2">What are you having?</h1>
          <p className="muted">Pick as many as you like. We'll add up the time and hold one slot for all of it.</p>
          {/* A man booking a cut shouldn't scroll past nine hair services to reach the barbershop. */}
          <div className="chips hscroll group-filter" role="group" aria-label="Show services for">
            <button className={`chip ${groupFilter === "all" ? "is-active" : ""}`} onClick={() => setGroupFilter("all")} aria-pressed={groupFilter === "all"}>
              Everything
            </button>
            {GROUP_ORDER.map((group) => (
              <button key={group} className={`chip ${groupFilter === group ? "is-active" : ""}`} onClick={() => setGroupFilter(group)} aria-pressed={groupFilter === group}>
                {GROUP_LABEL[group]}
                {serviceIds.some((id) => serviceById(id)?.group === group) && <span className="chip-count">{serviceIds.filter((id) => serviceById(id)?.group === group).length}</span>}
              </button>
            ))}
          </div>
          {GROUP_ORDER.filter((group) => groupFilter === "all" || group === groupFilter).map((group) => {
            const inGroup = SERVICES.filter((s) => s.group === group && s.bookable && s.active !== false);
            if (!inGroup.length) return null;
            return (
              <div key={group} className="stack gap-8">
                <h2 className="t-h3">{GROUP_LABEL[group]}</h2>
                <div className="stack gap-8">
                  {inGroup.map((service) => {
                    const picked = serviceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        className={`select-card ${picked ? "is-selected" : ""}`}
                        onClick={() => toggleService(service.id)}
                        aria-pressed={picked}
                      >
                        <span className="row-icon" aria-hidden="true">
                          <Sparkles size={18} strokeWidth={1.8} />
                        </span>
                        <span className="grow stack gap-4">
                          <span className="t-title">{service.name}</span>
                          <span className="muted t-cap">{durationLabel(service.minutes)}</span>
                        </span>
                        <span className="stack gap-4" style={{ alignItems: "flex-end" }}>
                          <span className="tabular">{priceLabel(service)}</span>
                          {picked && <Check size={18} strokeWidth={2} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {step === 2 && (
        <section className="stack gap-16">
          <h1 className="t-h2">When suits you?</h1>

          <div className="stack gap-8">
            <h2 className="t-h3">Who with</h2>
            <div className="pro-grid" role="group" aria-label="Choose who does it">
              <button
                className={`select-card pro-card ${staffChoice === ANY ? "is-selected" : ""}`}
                onClick={() => {
                  setStaffChoice(ANY);
                  setStart("");
                }}
                aria-pressed={staffChoice === ANY}
              >
                <span className="pro-any" aria-hidden="true">
                  <Shuffle size={18} strokeWidth={1.8} />
                </span>
                <span className="grow stack gap-4">
                  <span className="t-title">Anyone free</span>
                  <span className="muted t-cap">The most times to choose from</span>
                </span>
                {staffChoice === ANY && <Check size={18} strokeWidth={2} />}
              </button>
              {eligible.map((staff) => (
                <button
                  key={staff.id}
                  className={`select-card pro-card ${staffChoice === staff.id ? "is-selected" : ""}`}
                  onClick={() => {
                    setStaffChoice(staff.id);
                    setStart("");
                  }}
                  aria-pressed={staffChoice === staff.id}
                >
                  <Avatar name={staff.name} size={40} soft />
                  <span className="grow stack gap-4" style={{ minWidth: 0 }}>
                    <span className="t-title truncate">{staff.name}</span>
                    <span className="muted t-cap">
                      {ROLE_LABEL[staff.role]}
                      {account?.hair?.preferredStaffId === staff.id ? " · your usual" : ""}
                    </span>
                  </span>
                  {staffChoice === staff.id && <Check size={18} strokeWidth={2} />}
                </button>
              ))}
            </div>
            {eligible.length === 0 && (
              <p className="muted">
                Nobody at {branch.name} covers all of those together. Try another branch, or book them as two visits.
              </p>
            )}
          </div>

          <div className="stack gap-8">
            <h2 className="t-h3">Day</h2>
            <DateStrip
              days={days}
              selected={dayKeyValue}
              label="Choose a day"
              onSelect={(key) => {
                setDayKeyValue(key);
                setStart("");
              }}
              stateFor={(day) => ({ disabled: !openingOn(branch, day) })}
            />
          </div>

          <div className="stack gap-8">
            <h2 className="t-h3">Time</h2>
            {!dayKeyValue ? (
              <p className="muted">Choose a day to see what's free.</p>
            ) : slots.length === 0 ? (
              <div className="empty">
                <p className="t-title">Nothing free that day</p>
                <p className="muted">
                  {durationLabel(minutes)} is a long stretch. Try another day, or ask us on WhatsApp and we'll fit you in.
                </p>
              </div>
            ) : (
              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    className={`slot ${slot === start ? "is-selected" : ""}`}
                    onClick={() => setStart(slot)}
                    aria-pressed={slot === start}
                  >
                    {fmtTime(parseLocal(slot))}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="stack gap-16">
          <h1 className="t-h2">Your details</h1>
          <p className="muted">We use your WhatsApp number to confirm the booking and remind you the day before.</p>

          <div className="stack gap-12">
            <label className="field">
              <span>Full name</span>
              <input
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>
            <label className="field">
              <span>WhatsApp number</span>
              <input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                inputMode="tel"
                autoComplete="tel"
                placeholder="024 123 4567"
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </label>
            <label className="field">
              <span>Email</span>
              <input
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>
            <label className="field">
              <span>Town or area</span>
              <input
                value={contact.area}
                onChange={(e) => setContact({ ...contact, area: e.target.value })}
                autoComplete="address-level2"
                aria-invalid={Boolean(errors.area)}
              />
              {errors.area && <span className="field-error">{errors.area}</span>}
            </label>
            {needsAllergyCheck && (
              <label className="field">
                <span>Any allergies or scalp sensitivities? (needed for relaxer, colour and dye)</span>
                <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="None, or tell us what to avoid" />
              </label>
            )}
            <label className="field">
              <span>Anything we should know? (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Allergies, bringing my own hair, coming with a child…"
              />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="muted">Remember my details on this phone</span>
            </label>
          </div>

          <div className="card card-pad stack gap-8">
            <p className="receipt-label">Your booking</p>
            <div className="kv">
              <span>{branch.name}</span>
              <span>{start ? fmtDayShort(parseLocal(start)) : "—"}</span>
            </div>
            <div className="kv muted">
              <span>{staffChoice === ANY ? "With whoever is free" : `With ${eligible.find((s) => s.id === staffChoice)?.name ?? ""}`}</span>
              <span>{start && end ? `${fmtTime(parseLocal(start))}–${fmtTime(end)}` : ""}</span>
            </div>
            {chosen.map((service) => (
              <div key={service.id} className="kv muted">
                <span>{service.name}</span>
                <span>{money(service.price)}</span>
              </div>
            ))}
            <div className="kv">
              <span>Time set aside</span>
              <span>{durationLabel(minutes)}</span>
            </div>
            <div className="divider" />
            <div className="kv kv-total">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <div className="kv">
              <span className="muted">Deposit to hold your chair</span>
              <span>{money(deposit)}</span>
            </div>
          </div>

          <div className="card card-pad stack gap-4">
            <p className="t-title">Cancellation policy</p>
            <p className="muted t-cap">
              Free to cancel or move up to {POLICIES.cancelWindowHours} hours before. After that, or if you don't come, the deposit is kept.
            </p>
          </div>

          {formError && <p className="field-error" role="alert">{formError}</p>}
        </section>
      )}

      <div className="sticky-bar">
        <div className="sticky-bar-meta">
          <strong>{total ? money(total) : "No services yet"}</strong>
          <span className="muted t-cap">
            {chosen.length ? `${chosen.length} service${chosen.length > 1 ? "s" : ""} · ${durationLabel(minutes)}` : "Pick what you'd like"}
          </span>
        </div>
        {step < 3 ? (
          <Cta disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Cta>
        ) : (
          <div className="inline gap-8">
            <button className="btn btn-outline" onClick={() => submit()}>
              Book, pay at salon
            </button>
            <Cta onClick={() => setPayOpen(true)}>Pay {money(deposit)}</Cta>
          </div>
        )}
      </div>

      <PaystackSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={deposit}
        label={`Deposit for ${branch.name}`}
        email={contact.email}
        phone={contact.phone || SALON.phone}
        onPaid={(payment) => {
          const error = submit(payment);
          if (!error) setPayOpen(false);
          return error;
        }}
      />
    </main>
  );
}

/** Exported for the tests in data/store.test.ts to mirror the same day maths. */
export const bookingDays = (now: Date) => Array.from({ length: DAYS_AHEAD }, (_, i) => dayKey(addDays(startOfDay(now), i)));
