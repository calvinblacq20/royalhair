import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SALON } from "../data/business";
import { DEMO_ACCOUNT_PHONE } from "../data/seed";
import { actions } from "../data/store";
import { CODE_MESSAGE, normalizeVisitNumber } from "../lib/checkout";
import { formatGhPhone, normalizeGhPhone } from "../lib/contact";
import { Button } from "./Button";
import { useNotify } from "./Notify";
import { Sheet } from "./Sheet";

const RESEND_SECONDS = 30;
const PHONE_ERROR = "Enter a Ghana WhatsApp number, like 024 123 4567.";

/** Sends a 6-digit code to a WhatsApp number and checks it. In the demo the "WhatsApp message" arrives as a notification. */
function CodeStep({ phone, onVerified, onChangeNumber, cta }: { phone: string; onVerified: () => void; onChangeNumber: () => void; cta: string }) {
  const notify = useNotify();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const sent = actions.sendCode(phone);
    notify("Your code", `${sent} is your ${SALON.name} code. It expires in 10 minutes. Don't share it with anyone.`);
    setWait(RESEND_SECONDS);
    setCode("");
    setError("");
  };

  // Send once when the step opens; resends are manual.
  useEffect(() => {
    send();
    const focus = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(focus);
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  return (
    <form
      className="stack gap-16"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(code)) {
          setError("Enter the 6-digit code from WhatsApp.");
          return;
        }
        const result = actions.checkCode(phone, code);
        if (result === "ok") onVerified();
        else setError(CODE_MESSAGE[result]);
      }}
    >
      <p className="muted">
        We sent a 6-digit code to WhatsApp on <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{formatGhPhone(phone)}</strong>.
      </p>
      <div className="field">
        <label htmlFor="code">Code</label>
        <input
          ref={inputRef}
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError("");
          }}
          style={{ fontSize: 24, letterSpacing: "0.3em", fontFamily: "var(--mono)" }}
          aria-invalid={Boolean(error)}
          aria-describedby="code-hint"
        />
        <span id="code-hint" className={error ? "error" : "hint"}>
          {error || "Demo: the code shows up as a notification at the top of the screen."}
        </span>
      </div>
      <Button variant="dark" block type="submit">
        {cta}
      </Button>
      <div className="between t-cap">
        <button type="button" className="link" onClick={onChangeNumber}>
          Change number
        </button>
        <button type="button" className="link" onClick={send} disabled={wait > 0} style={wait > 0 ? { color: "var(--ink-50)" } : undefined}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}

type AccountMode = "login" | "create";

/** Optional account: log in or save your visits with just a WhatsApp number and a code. No password. */
export function AccountSheet({ open, onClose, mode = "login", defaultName = "", defaultPhone = "", onDone }: {
  open: boolean;
  onClose: () => void;
  mode?: AccountMode;
  defaultName?: string;
  defaultPhone?: string;
  onDone?: () => void;
}) {
  const notify = useNotify();
  const [current, setCurrent] = useState<AccountMode>(mode);
  const [stage, setStage] = useState<"details" | "code">("details");
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [switchTo, setSwitchTo] = useState<{ text: string; mode: AccountMode } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent(mode);
    setStage("details");
    setName(defaultName);
    setPhone(defaultPhone);
    setErrors({});
    setSwitchTo(null);
  }, [open, mode, defaultName, defaultPhone]);

  const submitDetails = () => {
    const next: typeof errors = {};
    if (!normalizeGhPhone(phone)) next.phone = PHONE_ERROR;
    if (current === "create" && name.trim().length < 2) next.name = "Enter your full name.";
    setErrors(next);
    setSwitchTo(null);
    if (Object.keys(next).length) return;

    const existing = actions.customerForPhone(phone);
    if (current === "login" && !existing?.hasAccount) {
      setSwitchTo({
        text: existing ? "You've booked with this number, but it isn't saved as an account yet." : "There's no account for this number yet.",
        mode: "create",
      });
      if (existing && !name) setName(existing.name);
      return;
    }
    if (current === "create" && existing?.hasAccount) {
      setSwitchTo({ text: "This number already has an account.", mode: "login" });
      return;
    }
    setStage("code");
  };

  const verified = () => {
    if (current === "login") {
      const customer = actions.logIn(phone);
      notify("Logged in", `Welcome back, ${customer?.name.split(" ")[0] ?? "there"}. Your visits and receipts are here.`);
    } else {
      const customer = actions.createAccount({ name: name.trim(), phone: formatGhPhone(phone) });
      notify("Account created", `Your visits and receipts are saved to ${formatGhPhone(customer.phone)}.`);
    }
    onClose();
    onDone?.();
  };

  const title = stage === "code" ? "Enter your code" : current === "login" ? "Log in" : "Create an account";

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {stage === "code" ? (
        <CodeStep phone={phone} cta={current === "login" ? "Log in" : "Create account"} onVerified={verified} onChangeNumber={() => setStage("details")} />
      ) : (
        <form
          className="stack gap-16"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitDetails();
          }}
        >
          <p className="muted">
            {current === "login"
              ? "We'll send a code to your WhatsApp. No password needed."
              : "Optional. Keep your visits, receipts and loyalty points on any phone. We'll confirm your WhatsApp number with a code."}
          </p>
          {current === "create" && (
            <div className="field">
              <label htmlFor="acct-name">Full name</label>
              <input id="acct-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby="acct-name-hint" />
              {errors.name && (
                <span id="acct-name-hint" className="error">
                  {errors.name}
                </span>
              )}
            </div>
          )}
          <div className="field">
            <label htmlFor="acct-phone">WhatsApp number</label>
            <input id="acct-phone" inputMode="tel" autoComplete="tel-national" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby="acct-phone-hint" />
            <span id="acct-phone-hint" className={errors.phone ? "error" : "hint"}>
              {errors.phone ||
                (current === "login" ? (
                  <>
                    Sample account:{" "}
                    <button type="button" className="link t-cap" onClick={() => setPhone(DEMO_ACCOUNT_PHONE)}>
                      {DEMO_ACCOUNT_PHONE}
                    </button>
                  </>
                ) : (
                  "Booking confirmations and reminders come here."
                ))}
            </span>
          </div>
          {switchTo && (
            <div className="banner is-sand">
              <p>{switchTo.text}</p>
              <button
                type="button"
                className="banner-cta"
                onClick={() => {
                  setCurrent(switchTo.mode);
                  setSwitchTo(null);
                }}
              >
                {switchTo.mode === "create" ? "Create an account" : "Log in instead"}
              </button>
            </div>
          )}
          <Button variant="dark" block type="submit">
            Send code
          </Button>
          <button type="button" className="link t-cap" style={{ alignSelf: "center" }} onClick={() => setCurrent(current === "login" ? "create" : "login")}>
            {current === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
        </form>
      )}
    </Sheet>
  );
}

/** Opens a visit booked on another phone: booking number plus the WhatsApp number used, confirmed with a code. */
export function FindVisitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"form" | "code">("form");
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ number?: string; phone?: string; match?: string }>({});
  const [visitId, setVisitId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage("form");
    setErrors({});
    setVisitId(null);
  }, [open]);

  const submit = () => {
    const next: typeof errors = {};
    if (!normalizeVisitNumber(number)) next.number = "Enter the booking number from your WhatsApp message, like RH-1041.";
    if (!normalizeGhPhone(phone)) next.phone = PHONE_ERROR;
    if (!next.number && !next.phone) {
      const visit = actions.lookUpVisit(number, phone);
      if (visit) {
        setVisitId(visit.id);
        setStage("code");
      } else next.match = "We couldn't find a booking with that booking number and WhatsApp number. Check both, or message the salon.";
    }
    setErrors(next);
  };

  return (
    <Sheet open={open} onClose={onClose} title={stage === "code" ? "Enter your code" : "Find my booking"}>
      {stage === "code" && visitId ? (
        <CodeStep
          phone={phone}
          cta="Open my booking"
          onChangeNumber={() => setStage("form")}
          onVerified={() => {
            actions.addVisitToDevice(visitId);
            onClose();
            navigate(`/visits/${visitId}`);
          }}
        />
      ) : (
        <form
          className="stack gap-16"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="muted">Booked on another phone, or cleared this one? Use the booking number and the WhatsApp number you booked with.</p>
          <div className="field">
            <label htmlFor="find-number">Booking number</label>
            <input id="find-number" autoCapitalize="characters" placeholder="RH-1041" value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={Boolean(errors.number)} aria-describedby="find-number-hint" style={{ fontFamily: "var(--mono)" }} />
            {errors.number && (
              <span id="find-number-hint" className="error">
                {errors.number}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="find-phone">WhatsApp number</label>
            <input id="find-phone" inputMode="tel" autoComplete="tel-national" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby="find-phone-hint" />
            {errors.phone && (
              <span id="find-phone-hint" className="error">
                {errors.phone}
              </span>
            )}
          </div>
          {errors.match && (
            <p className="t-cap" role="alert" style={{ color: "var(--danger)" }}>
              {errors.match}
            </p>
          )}
          <Button variant="dark" block type="submit">
            Send code
          </Button>
        </form>
      )}
    </Sheet>
  );
}
