import { AlertTriangle, ArrowUp, CalendarDays, Check, Clock, Lock, Mail, MapPin, Phone, Plus, Send, Shuffle, UserRound, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccountSheet } from "../components/AccountSheets";
import { AppIcon } from "../components/Brand";
import { Skeleton, Stars, useSkeleton } from "../components/Bits";
import { Button, Cta, Dots } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { SuccessScreen } from "../components/Overlays";
import { PaystackSheet } from "../components/Paystack";
import { DateStrip } from "../components/Pickers";
import { useScrollTo } from "../components/Scroll";
import { Sheet } from "../components/Sheet";
import { BRANCHES, POLICIES, SALON } from "../data/business";
import { GROUP_LABEL, GROUPS, ROLE_LABEL, SERVICES, serviceById } from "../data/catalog";
import { accessOf, accountOf, actions, useAppData, type OnlinePayment } from "../data/store";
import type { Branch, ContactDetails, Service, Staff, Visit } from "../data/types";
import { availabilityFor, leastBusy, openingOn, slotsFor, staffFor } from "../lib/booking";
import { canViewVisit, cleanContact, contactFromCustomer, EMPTY_CONTACT, validateContact, type ContactErrors } from "../lib/checkout";
import { formatGhPhone } from "../lib/contact";
import { fmtDayLong, fmtDayShort, fmtTime, localIso, money, parseLocal, plural } from "../lib/format";
import { depositFor, durationLabel, priceLabel } from "../lib/pricing";
import { openStatus, dateStrip } from "../lib/schedule";
import { spring } from "../motion";

const STEP_TITLES = ["Choose your services", "Branch and stylist", "Date and time", "Your details", "Review and pay"] as const;
const CRUMBS = ["Services", "Stylist", "Date & time", "Details", "Pay"] as const;
const DETAILS_STEP = 3;
const REVIEW_STEP = 4;
const FIELD_ORDER: (keyof ContactDetails)[] = ["name", "phone", "email", "area"];
/** "Anyone free" spreads work across the floor instead of piling it on one stylist. */
const ANY = "any";
/** Quarter-hour starts: a shape-up is 15 minutes and a cut is 30, so half-hour slots would waste the barber's day. */
const STEP_MINUTES = 15;
/** Services that touch the scalp with chemicals, where an allergy has to be known before starting. */
const CHEMICAL = new Set(["s-perm", "s-colour", "s-dye"]);

export function BookFlow() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const data = useAppData();
  const now = useMemo(() => new Date(), []);
  const account = accountOf(data);

  // "Book again" from a past visit: same branch, services and stylist. Only for visits this phone can see.
  const [rebookFrom] = useState<Visit | undefined>(() => {
    const id = params.get("rebook");
    const visit = id ? data.visits.find((v) => v.id === id) : undefined;
    return visit && canViewVisit(visit, accessOf(data)) ? visit : undefined;
  });

  const [step, setStep] = useState(rebookFrom ? 2 : 0);
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    if (rebookFrom) return rebookFrom.items.map((i) => i.serviceId).filter((id) => serviceById(id)?.bookable);
    const requested = serviceById(params.get("service") ?? "");
    return requested?.bookable ? [requested.id] : [];
  });
  const [branchId, setBranchId] = useState(() => rebookFrom?.branchId ?? data.device.branchId ?? account?.hair?.preferredBranchId ?? BRANCHES[0]!.id);
  const [staffChoice, setStaffChoice] = useState<string>(() => rebookFrom?.staffId ?? account?.hair?.preferredStaffId ?? ANY);
  const [start, setStart] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [allergies, setAllergies] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: string; receiptNo?: string; email: string } | null>(null);

  // Signed-in clients start from their account; guests from what this phone remembers, if anything.
  const [contact, setContact] = useState<ContactDetails>(() => (account ? contactFromCustomer(account) : data.device.contact ?? EMPTY_CONTACT));
  const [remember, setRemember] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [payChoice, setPayChoice] = useState<"now" | "later">("now");
  const [payOpen, setPayOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const scrollTo = useScrollTo();
  useEffect(() => {
    scrollTo(0, { immediate: true });
  }, [step, scrollTo]);

  const branch = data.branches.find((b) => b.id === branchId) ?? data.branches[0]!;
  const chosen = serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));
  const minutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const hasFrom = chosen.some((s) => s.priceFrom);
  const deposit = depositFor(total, POLICIES.depositRate);
  const depositPct = Math.round(POLICIES.depositRate * 100);
  const eligible = useMemo(() => staffFor(data.staff, branch.id, chosen), [data.staff, branch.id, chosen]);
  const needsAllergyCheck = chosen.some((s) => CHEMICAL.has(s.id));
  const contactErrors = validateContact(contact);
  const firstContactError = FIELD_ORDER.find((key) => contactErrors[key]);
  const named = staffChoice === ANY ? null : eligible.find((s) => s.id === staffChoice) ?? null;

  // A guest who logs in part-way through gets their account details.
  useEffect(() => {
    if (account) setContact(contactFromCustomer(account));
  }, [account]);
  // A usual stylist who doesn't cover this basket, or works at another branch, falls back to whoever is free.
  useEffect(() => {
    if (staffChoice !== ANY && !eligible.some((s) => s.id === staffChoice)) setStaffChoice(ANY);
  }, [eligible, staffChoice]);

  /** Every staff member who could take this basket at this time. */
  const freeAt = useCallback(
    (at: string) => {
      const day = parseLocal(at);
      const people = named ? [named] : eligible;
      return availabilityFor({ branch, staff: people, day, minutes, visits: data.visits, now }, { stepMinutes: STEP_MINUTES, gapMinutes: POLICIES.turnaroundMinutes })
        .filter((a) => a.slots.includes(at))
        .map((a) => a.staff);
    },
    [named, eligible, branch, minutes, data.visits, now],
  );

  // A time that someone else has just taken must not stay selected.
  useEffect(() => {
    if (start && freeAt(start).length === 0) setStart(null);
  }, [start, freeAt]);

  const missing = (() => {
    if (step === 0 && chosen.length === 0) return "Choose at least one service";
    if (step === 1 && eligible.length === 0) return `Nobody at ${branch.name} does all of those together`;
    if (step === 2 && !start) return "Pick a time";
    if (step === DETAILS_STEP && showErrors && firstContactError) return contactErrors[firstContactError] ?? null;
    return null;
  })();

  const toggleService = (id: string) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
    setStart(null);
  };

  const back = () => (step > 0 ? setStep(step - 1) : navigate(-1));

  /** Books the visit in one step: client record, visit and (when paid now) the receipt. Returns an error to show, or null. */
  const book = (payment?: OnlinePayment): string | null => {
    if (!start) return "Pick a time";
    const people = freeAt(start);
    const staff: Staff | null = named ?? leastBusy(people, data.visits, parseLocal(start));
    if (!staff) {
      setStep(2);
      return "That time has just gone. Please pick another.";
    }
    const clean = cleanContact(contact);
    const result = actions.book({
      branchId: branch.id,
      staffId: staff.id,
      serviceIds,
      start,
      contact: clean,
      remember: account ? false : remember,
      notes: comments.trim() || undefined,
      allergies: needsAllergyCheck ? allergies : undefined,
      payment,
    });
    if ("error" in result) {
      if (result.error.includes("just booked") || result.error.includes("passed")) setStep(2);
      return result.error;
    }
    setPayOpen(false);
    setCreated({ id: result.visit.id, number: result.visit.number, receiptNo: result.payment?.receiptNo, email: clean.email });
    return null;
  };

  const sendRequest = async () => {
    setSubmitting(true);
    await new Promise((r) => window.setTimeout(r, 900));
    const error = book();
    setSubmitting(false);
    if (error) notify("Couldn't book that time", error);
  };

  const continueFromDetails = () => {
    setShowErrors(true);
    if (firstContactError) {
      document.getElementById(`contact-${firstContactError}`)?.focus();
      return;
    }
    setContact(cleanContact(contact));
    setStep(REVIEW_STEP);
  };

  const onSuccessDone = useCallback(() => {
    if (!created) return;
    navigate(`/visits/${created.id}`, { replace: true });
    window.setTimeout(
      () =>
        created.receiptNo
          ? notify("Deposit received", `Receipt ${created.receiptNo} for ${created.number} is ready. A copy is on its way to ${created.email}.`)
          : notify("Booking received", `We've got ${created.number}. We'll confirm on WhatsApp.`),
      700,
    );
  }, [created, navigate, notify]);

  const cta =
    step < DETAILS_STEP ? (
      <Cta onClick={() => setStep(step + 1)} disabled={Boolean(missing)}>
        Continue
      </Cta>
    ) : step === DETAILS_STEP ? (
      <Cta onClick={continueFromDetails}>Continue</Cta>
    ) : payChoice === "now" ? (
      <Cta onClick={() => setPayOpen(true)}>Pay {money(deposit)}</Cta>
    ) : (
      <Cta onClick={sendRequest} loading={submitting}>
        Book now
      </Cta>
    );

  const startDate = start ? parseLocal(start) : null;
  const endDate = startDate ? new Date(startDate.getTime() + minutes * 60_000) : null;

  return (
    <main className="screen flow-screen">
      <TopBar
        back={back}
        close={() => navigate("/")}
        title={STEP_TITLES[step]}
        right={
          <nav className="flow-crumbs desktop-only" aria-label="Booking steps">
            {CRUMBS.map((label, i) => (
              <span key={label} className="inline" style={{ gap: 6 }}>
                {i > 0 && (
                  <span className="flow-crumb-sep" aria-hidden="true">
                    ›
                  </span>
                )}
                <button className={`flow-crumb ${i === step ? "is-current" : i < step ? "is-done" : ""}`} disabled={i >= step} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
                  {label}
                </button>
              </span>
            ))}
          </nav>
        }
      />
      <div className="flow-progress mobile-only" aria-hidden="true">
        {STEP_TITLES.map((t, i) => (
          <span key={t}>
            <motion.i initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring.press} />
          </span>
        ))}
      </div>

      <div className="flow-layout">
        <div className="flow-main stack" style={{ minWidth: 0 }}>
          <h1 className="t-h2" style={{ padding: "8px 0 16px" }}>
            {STEP_TITLES[step]}
          </h1>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={spring.small} className="stack" style={{ flex: 1 }}>
              {step === 0 && <ChooseServices serviceIds={serviceIds} onToggle={toggleService} />}
              {step === 1 && (
                <BranchAndStylist
                  now={now}
                  branches={data.branches.filter((b) => b.active)}
                  branchId={branch.id}
                  setBranchId={(id) => {
                    setBranchId(id);
                    setStart(null);
                  }}
                  eligible={eligible}
                  staffChoice={staffChoice}
                  setStaffChoice={(id) => {
                    setStaffChoice(id);
                    setStart(null);
                  }}
                  usualStaffId={account?.hair?.preferredStaffId}
                />
              )}
              {step === 2 && <DateAndTime now={now} branch={branch} people={named ? [named] : eligible} minutes={minutes} visits={data.visits} start={start} setStart={setStart} who={named?.name} />}
              {step === DETAILS_STEP && (
                <YourDetails
                  contact={contact}
                  setContact={setContact}
                  errors={showErrors ? contactErrors : {}}
                  accountName={account?.name}
                  remember={remember}
                  setRemember={setRemember}
                  onLogIn={() => setLoginOpen(true)}
                  needsAllergyCheck={needsAllergyCheck}
                  allergies={allergies}
                  setAllergies={setAllergies}
                />
              )}
              {step === REVIEW_STEP && (
                <Review
                  branch={branch}
                  services={chosen}
                  staffName={named?.name}
                  start={startDate}
                  end={endDate}
                  total={total}
                  hasFrom={hasFrom}
                  deposit={deposit}
                  depositPct={depositPct}
                  contact={contact}
                  comments={comments}
                  setComments={setComments}
                  allergies={needsAllergyCheck ? allergies : ""}
                  onEditDetails={() => setStep(DETAILS_STEP)}
                  payChoice={payChoice}
                  setPayChoice={setPayChoice}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop: sticky booking summary with the step button */}
        <aside className="flow-aside desk" aria-label="Booking summary">
          <div className="card aside-card stack gap-12">
            <div className="inline" style={{ gap: 12 }}>
              <AppIcon size={44} />
              <div className="stack">
                <p className="t-title">{SALON.name}</p>
                <span className="subtle t-cap">{branch.name}</span>
              </div>
            </div>
            <div className="divider" style={{ margin: 0 }} />
            {chosen.length === 0 ? (
              <p className="muted">No services yet. Pick one to see your total.</p>
            ) : (
              chosen.map((service) => (
                <div key={service.id} className="kv">
                  <span className="stack">
                    <span>{service.name}</span>
                    <span className="subtle t-cap">{durationLabel(service.minutes)}</span>
                  </span>
                  <span>{priceLabel(service)}</span>
                </div>
              ))
            )}
            {startDate && endDate && (
              <p className="info-line t-cap muted">
                <CalendarDays size={14} />
                <span>
                  {fmtDayShort(startDate)}, {fmtTime(startDate)}–{fmtTime(endDate)}
                </span>
              </p>
            )}
            {step >= 1 && (
              <p className="info-line t-cap muted">
                <UserRound size={14} />
                <span>{named ? `With ${named.name}` : "With whoever is free"}</span>
              </p>
            )}
            <div className="divider" style={{ margin: 0 }} />
            <div className="kv kv-total">
              <span>{hasFrom ? "From" : "Total"}</span>
              <span>{money(total)}</span>
            </div>
            {chosen.length > 0 && (
              <div className="kv muted t-cap">
                <span>Deposit to hold your chair ({depositPct}%)</span>
                <span>{money(deposit)}</span>
              </div>
            )}
            {step === REVIEW_STEP && (
              <p className="info-line t-cap muted">
                {payChoice === "now" ? <Lock size={14} /> : <Send size={14} />}
                <span>{payChoice === "now" ? "Mobile Money or card through Paystack" : "Pay at the salon on the day"}</span>
              </p>
            )}
            {missing && (
              <p className="t-cap" style={{ color: "var(--warning-ink)" }}>
                {missing}
              </p>
            )}
            <div className="stack" style={{ marginTop: 4 }}>
              {cta}
            </div>
          </div>
          <p className="t-cap subtle" style={{ textAlign: "center" }}>
            {hasFrom ? "\"From\" prices are confirmed at the chair before we start." : "Your deposit comes off the bill on the day."}
          </p>
        </aside>
      </div>

      <div className="sticky-bar lt-desk">
        <div className="sticky-bar-meta">
          {step === REVIEW_STEP ? (
            <>
              <span className="subtle t-cap">{payChoice === "now" ? `Deposit today · total ${money(total)}` : "Pay at the salon"}</span>
              <strong className="tabular">{money(payChoice === "now" ? deposit : total)}</strong>
            </>
          ) : step === DETAILS_STEP ? (
            <>
              <strong className="tabular">
                {hasFrom ? "from " : ""}
                {money(total)}
              </strong>
              <span className="t-cap" style={missing ? { color: "var(--warning-ink)" } : undefined}>
                {missing ?? "No account needed"}
              </span>
            </>
          ) : (
            <>
              <strong className="tabular">{chosen.length ? `${hasFrom ? "from " : ""}${money(total)}` : money(0)}</strong>
              <span className={`t-cap ${missing && step > 0 ? "" : "subtle"}`} style={missing && step > 0 ? { color: "var(--warning-ink)" } : undefined}>
                {missing && step > 0 ? missing : chosen.length ? `${plural(chosen.length, "service")} · ${durationLabel(minutes)}` : "No services yet"}
              </span>
            </>
          )}
        </div>
        {cta}
      </div>

      <PaystackSheet open={payOpen} onClose={() => setPayOpen(false)} amount={deposit} label="Deposit to hold your chair" email={contact.email} phone={contact.phone} onPaid={book} />
      <AccountSheet open={loginOpen} onClose={() => setLoginOpen(false)} mode="login" defaultPhone={contact.phone} />
      <SuccessScreen open={Boolean(created)} title={created?.receiptNo ? "Deposit paid" : "You're booked"} onDone={onSuccessDone} />
    </main>
  );
}

/* ---------------- Step 1: services ---------------- */

function ChooseServices({ serviceIds, onToggle }: { serviceIds: string[]; onToggle: (id: string) => void }) {
  const loading = useSkeleton(450);
  const [showPill, setShowPill] = useState(false);
  const firstSelected = useRef<HTMLDivElement | null>(null);
  const scrollTo = useScrollTo();

  useEffect(() => {
    const onScroll = () => setShowPill(window.scrollY > 260);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) return <ListSkeleton />;

  const bookable = SERVICES.filter((s) => s.bookable && s.active !== false);
  const selected = new Set(serviceIds);
  const firstSelectedId = bookable.find((s) => selected.has(s.id))?.id;

  return (
    <>
      <div className="chips" style={{ position: "sticky", top: 60, zIndex: 9, background: "var(--ground)", paddingBlock: 8 }}>
        {GROUPS.map((g) => (
          <button key={g.id} className="chip" onClick={() => scrollTo(document.getElementById(`group-${g.id}`), { offset: -120 })}>
            {g.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showPill && serviceIds.length > 0 && (
          <motion.button className="selected-pill" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring.small} onClick={() => scrollTo(firstSelected.current, { offset: -window.innerHeight / 3 })}>
            {serviceIds.length} selected <ArrowUp size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {GROUPS.map((g) => (
        <section key={g.id} id={`group-${g.id}`} className="section" style={{ scrollMarginTop: 120 }}>
          <h2 className="t-h3">{g.label}</h2>
          <div className="stack gap-12 flow-cards">
            {bookable
              .filter((s) => s.group === g.id)
              .map((service) => {
                const isOn = selected.has(service.id);
                return (
                  <div
                    key={service.id}
                    ref={service.id === firstSelectedId ? firstSelected : undefined}
                    role="checkbox"
                    aria-checked={isOn}
                    tabIndex={0}
                    className={`select-card ${isOn ? "is-selected" : ""}`}
                    onClick={() => onToggle(service.id)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
                        e.preventDefault();
                        onToggle(service.id);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="grow stack gap-4">
                      <p className="t-title">{service.name}</p>
                      <p className="subtle t-cap">About {durationLabel(service.minutes)}</p>
                      <p className="muted t-body">{service.description}</p>
                      <div className="between" style={{ marginTop: 6, minHeight: 36 }}>
                        <span className="tabular" style={{ fontWeight: 500 }}>
                          {priceLabel(service)}
                        </span>
                      </div>
                    </div>
                    <motion.span key={String(isOn)} className={`check ${isOn ? "is-on" : "is-add"}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.small} aria-hidden="true">
                      {isOn ? <Check size={16} strokeWidth={2.4} /> : <Plus size={16} />}
                    </motion.span>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
      <p className="t-cap subtle" style={{ textAlign: "center", marginTop: 20 }}>
        Sample prices. "From" prices are confirmed at the chair before we start.
      </p>
    </>
  );
}

/* ---------------- Step 2: branch and stylist ---------------- */

function BranchAndStylist({
  now,
  branches,
  branchId,
  setBranchId,
  eligible,
  staffChoice,
  setStaffChoice,
  usualStaffId,
}: {
  now: Date;
  branches: Branch[];
  branchId: string;
  setBranchId: (id: string) => void;
  eligible: Staff[];
  staffChoice: string;
  setStaffChoice: (id: string) => void;
  usualStaffId?: string;
}) {
  const loading = useSkeleton(450);
  if (loading) return <ListSkeleton />;
  return (
    <div className="stack gap-8">
      <section className="stack gap-12">
        <h2 className="t-h3">Which branch?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="Branch">
          {branches.map((b) => (
            <PlanCard key={b.id} selected={b.id === branchId} onSelect={() => setBranchId(b.id)} icon={<MapPin size={20} />} title={b.name} body={`${b.address} · ${openStatus(now, b.hours).label}`} />
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">Who would you like?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="Barber or stylist">
          <PlanCard selected={staffChoice === ANY} onSelect={() => setStaffChoice(ANY)} icon={<Shuffle size={20} />} title="Anyone free" body="The most times to choose from" />
          {eligible.map((s) => (
            <PlanCard
              key={s.id}
              selected={staffChoice === s.id}
              onSelect={() => setStaffChoice(s.id)}
              icon={<span style={{ fontWeight: 500, fontSize: 15 }}>{s.name.split(" ").map((p) => p[0]).join("")}</span>}
              title={s.name}
              body={`${ROLE_LABEL[s.role]}${usualStaffId === s.id ? " · your usual" : ""}`}
            />
          ))}
        </div>
        {eligible.length === 0 && <p className="muted">Nobody here covers all of those together. Try another branch, or book them as two visits.</p>}
      </section>
    </div>
  );
}

/* ---------------- Step 3: date and time ---------------- */

function DateAndTime({ now, branch, people, minutes, visits, start, setStart, who }: {
  now: Date;
  branch: Branch;
  people: Staff[];
  minutes: number;
  visits: Visit[];
  start: string | null;
  setStart: (s: string | null) => void;
  who?: string;
}) {
  const loading = useSkeleton(450);
  const [day, setDay] = useState<string | null>(start?.slice(0, 10) ?? null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!day) return;
    setSlotsLoading(true);
    const t = window.setTimeout(() => setSlotsLoading(false), 450);
    return () => window.clearTimeout(t);
  }, [day]);

  const free = useCallback(
    (d: Date) => {
      const set = new Set<string>();
      for (const staff of people) for (const slot of slotsFor({ branch, staff, day: d, minutes, visits, now }, { stepMinutes: STEP_MINUTES, gapMinutes: POLICIES.turnaroundMinutes })) set.add(slot);
      return set;
    },
    [people, branch, minutes, visits, now],
  );

  if (loading) return <ListSkeleton />;

  const days = dateStrip(now, 21);
  const opening = day ? openingOn(branch, parseLocal(day)) : null;
  const available = day ? free(parseLocal(day)) : new Set<string>();
  // Every start time in opening hours that leaves room for the work; the taken ones show greyed out.
  const times: string[] = [];
  if (opening) {
    for (let t = opening.start.getTime(); t + minutes * 60_000 <= opening.end.getTime(); t += STEP_MINUTES * 60_000) times.push(localIso(new Date(t)));
  }

  return (
    <div className="stack gap-8">
      <section className="stack gap-12">
        <h2 className="t-h3">Pick a day</h2>
        <DateStrip
          label="Visit day"
          days={days}
          selected={day ?? undefined}
          onSelect={(key) => {
            setDay(key);
            setStart(null);
          }}
          stateFor={(d) => ({ disabled: !openingOn(branch, d) || free(d).size === 0 })}
        />
        <p className="info-line muted">
          <Clock size={16} />
          <span>
            {durationLabel(minutes)} with {who ?? "whoever is free"} at {branch.name}.
          </span>
        </p>
      </section>

      {day && (
        <motion.section className="section" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
          <h2 className="t-h3">Pick a time</h2>
          {slotsLoading ? (
            <div className="slot" style={{ justifyContent: "center", color: "var(--ink-62)" }} aria-label="Loading times">
              <Dots />
            </div>
          ) : times.length === 0 || available.size === 0 ? (
            <p className="muted">Nothing free that day. Try another day, or message us on WhatsApp and we'll fit you in.</p>
          ) : (
            <div className="slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} role="radiogroup" aria-label="Visit time">
              {times.map((t, i) => (
                <motion.button
                  key={t}
                  role="radio"
                  aria-checked={start === t}
                  className={`slot ${start === t ? "is-selected" : ""}`}
                  style={{ justifyContent: "center", paddingInline: 0 }}
                  disabled={!available.has(t)}
                  onClick={() => setStart(t)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.small, delay: Math.min(i, 24) * 0.012 }}
                >
                  {fmtTime(parseLocal(t))}
                </motion.button>
              ))}
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
}

function PlanCard({ selected, onSelect, icon, title, body, disabled }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; body: string; disabled?: boolean }) {
  return (
    <button role="radio" aria-checked={selected} className={`select-card ${selected ? "is-selected" : ""}`} onClick={onSelect} disabled={disabled} style={{ alignItems: "center" }}>
      <span className="row-icon" style={{ width: 44, height: 44, borderRadius: 999, background: selected ? "var(--magenta)" : undefined }}>
        {icon}
      </span>
      <span className="grow stack">
        <span className="t-title">{title}</span>
        <span className="subtle t-cap">{body}</span>
      </span>
      <span className={`check ${selected ? "is-on" : "is-add"}`} aria-hidden="true">
        {selected && <Check size={16} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

/* ---------------- Step 4: your details ---------------- */

function YourDetails({ contact, setContact, errors, accountName, remember, setRemember, onLogIn, needsAllergyCheck, allergies, setAllergies }: {
  contact: ContactDetails;
  setContact: (c: ContactDetails) => void;
  errors: ContactErrors;
  accountName?: string;
  remember: boolean;
  setRemember: (v: boolean) => void;
  onLogIn: () => void;
  needsAllergyCheck: boolean;
  allergies: string;
  setAllergies: (v: string) => void;
}) {
  const set = (key: keyof ContactDetails) => (e: { target: { value: string } }) => setContact({ ...contact, [key]: e.target.value });
  const field = (key: keyof ContactDetails, label: string, props: InputHTMLAttributes<HTMLInputElement>, hint?: string) => (
    <div className="field">
      <label htmlFor={`contact-${key}`}>{label}</label>
      <input id={`contact-${key}`} value={contact[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} aria-describedby={`contact-${key}-hint`} {...props} />
      {(errors[key] || hint) && (
        <span id={`contact-${key}-hint`} className={errors[key] ? "error" : "hint"}>
          {errors[key] ?? hint}
        </span>
      )}
    </div>
  );

  return (
    <div className="stack gap-16">
      {accountName ? (
        <p className="info-line muted">
          <UserRound size={16} />
          <span>Logged in as {accountName}. Changes here update your account.</span>
        </p>
      ) : (
        <div className="card card-pad between" style={{ gap: 12 }}>
          <span className="stack">
            <span className="t-title">No account needed</span>
            <span className="muted t-cap">Booked before with an account? Log in to fill this in.</span>
          </span>
          <Button size="sm" onClick={onLogIn}>
            Log in
          </Button>
        </div>
      )}

      <section className="card card-pad stack gap-16">
        {field("name", "Full name", { autoComplete: "name", placeholder: "Ama Mensah" })}
        {field(
          "phone",
          "WhatsApp number",
          { inputMode: "tel", autoComplete: "tel-national", placeholder: "024 123 4567", readOnly: Boolean(accountName) },
          accountName ? "Your account number. Contact the salon to change it." : "Your confirmation and reminders come here.",
        )}
        {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "ama@gmail.com" }, "Paystack sends your payment receipt here.")}
        {field("area", "Town or area", { autoComplete: "address-level2", placeholder: "Weija" })}
      </section>

      {needsAllergyCheck && (
        <motion.section className="section" style={{ marginTop: 0 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
          <h2 className="t-h3">Before your colour or relaxer</h2>
          <div className="card card-pad stack gap-16">
            <div className="field">
              <label htmlFor="allergies">Any allergies or scalp sensitivities?</label>
              <input id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="None, or tell us what to avoid" aria-describedby="allergies-hint" />
              <span id="allergies-hint" className="hint">
                It goes on your record so whoever does your hair checks it first.
              </span>
            </div>
          </div>
        </motion.section>
      )}

      {!accountName && (
        <label className="check-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span className="stack">
            <span>Remember me on this phone</span>
            <span className="subtle t-cap">Fills this in next time. Don't tick it on a shared phone.</span>
          </span>
        </label>
      )}
    </div>
  );
}

/* ---------------- Step 5: review and pay ---------------- */

interface ReviewProps {
  branch: Branch;
  services: Service[];
  staffName?: string;
  start: Date | null;
  end: Date | null;
  total: number;
  hasFrom: boolean;
  deposit: number;
  depositPct: number;
  contact: ContactDetails;
  comments: string;
  setComments: (v: string) => void;
  allergies: string;
  onEditDetails: () => void;
  payChoice: "now" | "later";
  setPayChoice: (p: "now" | "later") => void;
}

function Review(r: ReviewProps) {
  const loading = useSkeleton(550);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState(r.comments);

  if (loading) return <ListSkeleton />;

  return (
    <div className="stack gap-8">
      <section className="card card-pad stack gap-12">
        <div className="inline" style={{ gap: 12 }}>
          <AppIcon size={52} />
          <div className="stack">
            <p className="t-title">{SALON.name}</p>
            <span className="inline t-cap" style={{ gap: 6 }}>
              <strong style={{ fontWeight: 500 }}>{SALON.rating}</strong> <Stars value={SALON.rating} size={12} /> <span className="subtle">({SALON.reviewCount})</span>
            </span>
            <span className="subtle t-cap">{r.branch.address}</span>
          </div>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        {r.start && r.end && (
          <>
            <p className="info-line">
              <CalendarDays size={16} />
              <span>{fmtDayLong(r.start)}</span>
            </p>
            <p className="info-line">
              <Clock size={16} />
              <span>
                {fmtTime(r.start)}–{fmtTime(r.end)} ({durationLabel(Math.round((r.end.getTime() - r.start.getTime()) / 60_000))})
              </span>
            </p>
          </>
        )}
        <p className="info-line">
          <UserRound size={16} />
          <span>{r.staffName ? `With ${r.staffName}` : "With whoever is free, confirmed on WhatsApp"}</span>
        </p>
        <p className="info-line">
          <MapPin size={16} />
          <span>
            {r.branch.name}
            {r.branch.landmark ? ` · ${r.branch.landmark}` : ""}
          </span>
        </p>
        <div className="divider" style={{ margin: 0 }} />
        {r.services.map((service) => (
          <div key={service.id} className="kv">
            <span className="stack">
              <span>{service.name}</span>
              <span className="subtle t-cap">
                {GROUP_LABEL[service.group]} · {durationLabel(service.minutes)}
              </span>
            </span>
            <span>{priceLabel(service)}</span>
          </div>
        ))}
        <div className="divider" style={{ margin: 0 }} />
        <div className="kv kv-total">
          <span>{r.hasFrom ? "Total, from" : "Total"}</span>
          <span>{money(r.total)}</span>
        </div>
        <div className="kv muted">
          <span>Deposit to hold your chair ({r.depositPct}%)</span>
          <span>{money(r.deposit)}</span>
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">How do you want to pay?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="When to pay">
          <PlanCard selected={r.payChoice === "now"} onSelect={() => r.setPayChoice("now")} icon={<Wallet size={20} />} title={`Pay ${money(r.deposit)} deposit now`} body="Mobile Money or card through Paystack. It comes off your bill on the day." />
          <PlanCard selected={r.payChoice === "later"} onSelect={() => r.setPayChoice("later")} icon={<Send size={20} />} title="Pay at the salon" body="Book free. We confirm on WhatsApp, and you pay everything on the day." />
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">More details</h2>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Cancellation policy</p>
          <p className="muted">Free to cancel or move up to {POLICIES.cancelWindowHours} hours before. After that, or if you don't come, the deposit is kept.</p>
        </div>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Deposit</p>
          <p className="muted">A {r.depositPct}% deposit holds your chair and comes off your bill. "From" prices are confirmed at the chair before we start.</p>
        </div>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Important info</p>
          <p className="muted">Please arrive 10 minutes early. Bringing your own hair or extensions? Add it in the note below.</p>
        </div>
        {r.allergies.trim() && (
          <div className="card card-pad stack gap-4">
            <p className="t-title inline" style={{ gap: 6 }}>
              <AlertTriangle size={15} /> Allergies you told us about
            </p>
            <p className="muted">{r.allergies.trim()}</p>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="t-h3">Comments or requests</h2>
        <div className="card card-pad between">
          <span className={r.comments ? "" : "muted"} style={{ whiteSpace: "pre-wrap" }}>
            {r.comments || "Anything we should know?"}
          </span>
          <Button
            size="sm"
            onClick={() => {
              setDraft(r.comments);
              setCommentsOpen(true);
            }}
          >
            {r.comments ? "Edit" : "Add"}
          </Button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h3">Your details</h2>
          <Button size="sm" onClick={r.onEditDetails}>
            Edit
          </Button>
        </div>
        <div className="card card-pad stack gap-8">
          <p className="t-title">{r.contact.name}</p>
          <p className="info-line muted">
            <Phone size={16} />
            <span>WhatsApp {formatGhPhone(r.contact.phone)}</span>
          </p>
          <p className="info-line muted">
            <Mail size={16} />
            <span>{r.contact.email}</span>
          </p>
          <p className="info-line muted">
            <MapPin size={16} />
            <span>{r.contact.area}</span>
          </p>
        </div>
      </section>

      <Sheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Comments or requests">
        <div className="stack gap-16">
          <div className="field">
            <label htmlFor="comments">Your note to the salon</label>
            <textarea id="comments" value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} placeholder="Bringing my own hair, coming with a child, a style photo on WhatsApp…" />
            <span className="hint">{draft.length}/600</span>
          </div>
          <Button
            variant="dark"
            block
            onClick={() => {
              r.setComments(draft.trim());
              setCommentsOpen(false);
            }}
          >
            Save note
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="stack gap-12" aria-busy="true" aria-label="Loading">
      <div className="inline" style={{ gap: 8 }}>
        {[80, 70, 90].map((w) => (
          <Skeleton key={w} w={w} h={36} r={500} />
        ))}
      </div>
      <Skeleton w="30%" h={20} style={{ marginTop: 12 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card card-pad stack gap-8">
          <Skeleton w="55%" h={16} />
          <Skeleton w="30%" h={12} />
          <div className="between">
            <Skeleton w="25%" h={14} />
            <Skeleton w={28} h={28} r={999} />
          </div>
        </div>
      ))}
    </div>
  );
}

