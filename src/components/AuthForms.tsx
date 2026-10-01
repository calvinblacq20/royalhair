import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import "../styles/auth.css";
import { POLICIES, SALON } from "../data/business";
import { auth } from "../data/auth";
import { clearAuthDraft, readAuthDraft, saveAuthDraft, type AuthDraft } from "../data/authDraft";
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD } from "../data/seed";
import type { Customer } from "../data/types";
import { AUTH_MESSAGE, validateLogin, validateSignUp, type AuthErrorCode } from "../lib/auth";
import { Cta } from "./Button";
import { useNotify } from "./Notify";
import { Sheet } from "./Sheet";

/* ---------------- Building blocks ---------------- */

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Shown at the end of the label row, e.g. "Forgot password?". */
  action?: ReactNode;
  children: ReactNode;
}

export function AuthField({ id, label, error, hint, action, children }: FieldProps) {
  return (
    <div className="auth-field">
      <div className="auth-label-row">
        <label className="auth-label" htmlFor={id}>
          {label}
        </label>
        {action}
      </div>
      <div className={`auth-input ${error ? "is-invalid" : ""}`}>{children}</div>
      {(error || hint) && (
        <span id={`${id}-msg`} className={`auth-msg ${error ? "is-error" : ""}`}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error || hint ? `${id}-msg` : undefined;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { id: string; label: string; error?: string; hint?: ReactNode; action?: ReactNode };

export function TextInput({ id, label, error, hint, action, ...input }: InputProps) {
  return (
    <AuthField id={id} label={label} error={error} hint={hint} action={action}>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} {...input} />
    </AuthField>
  );
}

export function PasswordInput({ id, label, error, hint, action, ...input }: InputProps) {
  const [shown, setShown] = useState(false);
  return (
    <AuthField id={id} label={label} error={error} hint={hint} action={action}>
      <input id={id} type={shown ? "text" : "password"} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} {...input} />
      <button type="button" className="auth-eye" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
        {shown ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
      </button>
    </AuthField>
  );
}

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function GoogleButton({ remember, onDone, onError, disabled }: { remember: boolean; onDone: (customer: Customer) => void; onError: (code: AuthErrorCode) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const result = await auth.signInWithGoogle(remember);
    setBusy(false);
    if ("error" in result) onError(result.error);
    else onDone(result.customer);
  };
  return (
    <button type="button" className="auth-google" onClick={go} disabled={busy || disabled} aria-busy={busy || undefined}>
      <GoogleMark />
      {busy ? "Connecting to Google…" : "Continue with Google"}
    </button>
  );
}

function Or() {
  return (
    <div className="auth-or" role="separator">
      or
    </div>
  );
}

/** Moves focus to the first field with a problem, so keyboard and screen-reader users land on it. */
function focusFirst(prefix: string, keys: string[]) {
  const first = keys[0];
  if (first) document.getElementById(`${prefix}-${first}`)?.focus();
}

function useWelcome() {
  const notify = useNotify();
  return (customer: Customer, created = false) => {
    const first = customer.name.split(" ")[0] || "there";
    if (created) notify("Account created", `Welcome, ${first}. Your bookings and receipts are saved to your account.`);
    else notify("Logged in", `Welcome back, ${first}. Your bookings and receipts are here.`);
  };
}

/* ---------------- Log in ---------------- */

export function LoginForm({ onDone, onSwitch, onForgot }: { onDone: (customer: Customer) => void; onSwitch: () => void; onForgot: () => void }) {
  const id = useId();
  const welcome = useWelcome();
  const [email, setEmail] = useState(() => readAuthDraft().email);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<AuthErrorCode | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = (customer: Customer) => {
    clearAuthDraft();
    welcome(customer);
    onDone(customer);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure(null);
    const found = validateLogin({ email, password });
    setErrors(found);
    if (Object.keys(found).length) return focusFirst(id, Object.keys(found));
    setBusy(true);
    const result = await auth.signIn(email, password, remember);
    setBusy(false);
    if ("error" in result) {
      setFailure(result.error);
      setPassword("");
      document.getElementById(`${id}-password`)?.focus();
    } else finish(result.customer);
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextInput
        id={`${id}-email`}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ama@gmail.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          saveAuthDraft({ email: e.target.value });
        }}
        error={errors.email}
      />
      <PasswordInput
        id={`${id}-password`}
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        action={
          <button type="button" className="auth-link" onClick={onForgot}>
            Forgot password?
          </button>
        }
      />
      <label className="auth-check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Remember me on this device</span>
      </label>
      {failure && (
        <p className="auth-alert" role="alert">
          {AUTH_MESSAGE[failure]}
        </p>
      )}
      <Cta type="submit" loading={busy}>
        Log in
      </Cta>
      <Or />
      <GoogleButton remember={remember} onDone={finish} onError={setFailure} disabled={busy} />
      <p className="auth-switch">
        Don't have an account?{" "}
        <button type="button" className="auth-link" onClick={onSwitch}>
          Create one
        </button>
      </p>
      {auth.kind === "demo" && (
        <p className="auth-sample">
          Demo account: {DEMO_ACCOUNT_EMAIL} · {DEMO_ACCOUNT_PASSWORD}
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setEmail(DEMO_ACCOUNT_EMAIL);
              setPassword(DEMO_ACCOUNT_PASSWORD);
              setErrors({});
            }}
          >
            Use it
          </button>
        </p>
      )}
    </form>
  );
}

/* ---------------- Sign up ---------------- */

export function SignUpForm({ onDone, onSwitch }: { onDone: (customer: Customer) => void; onSwitch: () => void }) {
  const id = useId();
  const welcome = useWelcome();
  const [draft, setDraft] = useState(readAuthDraft);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [failure, setFailure] = useState<AuthErrorCode | null>(null);
  const [busy, setBusy] = useState(false);

  const edit = (key: keyof AuthDraft) => (e: { target: { value: string } }) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
    saveAuthDraft({ [key]: e.target.value });
  };

  const finish = (customer: Customer, created: boolean) => {
    clearAuthDraft();
    welcome(customer, created);
    onDone(customer);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure(null);
    const found = validateSignUp({ ...draft, password, confirm, terms });
    setErrors(found);
    if (Object.keys(found).length) return focusFirst(id, Object.keys(found));
    setBusy(true);
    const result = await auth.signUp({ ...draft, password }, true);
    setBusy(false);
    if ("error" in result) {
      setFailure(result.error);
      document.getElementById(`${id}-${result.error === "phone-in-use" ? "phone" : "email"}`)?.focus();
    } else finish(result.customer, true);
  };

  const inUse = failure === "email-already-in-use" || failure === "phone-in-use";

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextInput id={`${id}-firstName`} label="First name" autoComplete="given-name" placeholder="Ama" value={draft.firstName} onChange={edit("firstName")} error={errors.firstName} />
      <TextInput id={`${id}-lastName`} label="Last name" autoComplete="family-name" placeholder="Mensah" value={draft.lastName} onChange={edit("lastName")} error={errors.lastName} />
      <TextInput
        id={`${id}-email`}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ama.mensah@gmail.com"
        value={draft.email}
        onChange={edit("email")}
        error={errors.email}
        hint="Receipts and password resets come here."
      />
      <TextInput
        id={`${id}-phone`}
        label="WhatsApp number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="024 123 4567"
        value={draft.phone}
        onChange={edit("phone")}
        error={errors.phone}
        hint="Booking confirmations and reminders come here. Visits you booked with this number move into your account."
      />
      <PasswordInput id={`${id}-password`} label="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="At least 8 characters, with letters and a number." />
      <PasswordInput id={`${id}-confirm`} label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
      <div className="auth-field">
        <label className="auth-check">
          <input id={`${id}-terms`} type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? `${id}-terms-msg` : undefined} />
          <span>
            I agree to the salon's{" "}
            <button type="button" className="auth-link" onClick={() => setTermsOpen(true)}>
              terms and privacy
            </button>
          </span>
        </label>
        {errors.terms && (
          <span id={`${id}-terms-msg`} className="auth-msg is-error">
            {errors.terms}
          </span>
        )}
      </div>
      {failure && (
        <div className="auth-alert" role="alert">
          <p>{AUTH_MESSAGE[failure]}</p>
          {inUse && (
            <button type="button" className="auth-link" onClick={onSwitch}>
              Log in instead
            </button>
          )}
        </div>
      )}
      <Cta type="submit" loading={busy}>
        Create account
      </Cta>
      <Or />
      <GoogleButton remember onDone={(customer) => finish(customer, false)} onError={setFailure} disabled={busy} />
      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" className="auth-link" onClick={onSwitch}>
          Log in
        </button>
      </p>
      <TermsSheet open={termsOpen} onClose={() => setTermsOpen(false)} />
    </form>
  );
}

/* ---------------- Forgot password ---------------- */

export function ForgotForm({ onBack, onOpenLink }: { onBack: () => void; onOpenLink: (link: string) => void }) {
  const id = useId();
  const [email, setEmail] = useState(() => readAuthDraft().email);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; link: string | null } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateLogin({ email, password: "x" }).email;
    setError(found);
    if (found) return document.getElementById(`${id}-email`)?.focus();
    setBusy(true);
    const result = await auth.sendPasswordReset(email);
    setBusy(false);
    setSent({ email: email.trim(), link: result.demoLink });
  };

  if (sent) {
    return (
      <div className="auth-form" aria-live="polite">
        <div className="auth-alert is-ok">
          <p>
            If an account uses <strong>{sent.email}</strong>, a link to reset your password is on its way. It works for 30 minutes.
          </p>
        </div>
        {auth.kind === "demo" && (
          <div className="auth-sample" style={{ flexDirection: "column" }}>
            <span>Demo inbox: {sent.link ? "the email has arrived." : "no account uses this email, so nothing was sent."}</span>
            {sent.link && (
              <button type="button" className="auth-link" onClick={() => onOpenLink(sent.link!)}>
                Open the reset link
              </button>
            )}
          </div>
        )}
        <p className="auth-switch">
          <button type="button" className="auth-link" onClick={onBack}>
            Back to log in
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <p className="muted" style={{ textAlign: "center" }}>
        Enter the email on your account and we'll send you a link to choose a new password.
      </p>
      <TextInput
        id={`${id}-email`}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ama@gmail.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          saveAuthDraft({ email: e.target.value });
        }}
        error={error}
      />
      <Cta type="submit" loading={busy}>
        Send reset link
      </Cta>
      <p className="auth-switch">
        Remembered it?{" "}
        <button type="button" className="auth-link" onClick={onBack}>
          Log in
        </button>
      </p>
    </form>
  );
}

/* ---------------- Terms ---------------- */

/** The short version, so the form isn't lost. The full pages open in a new tab. */
function TermsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Terms and privacy">
      <div className="stack gap-12">
        <p className="t-title">Bookings</p>
        <p className="muted">Booking online is free. Your booking is a request until the branch confirms your time and stylist on WhatsApp.</p>
        <p className="muted">Nothing is paid online. You pay at the salon when you're done, by cash, mobile money or card.</p>
        <p className="muted">
          Move or cancel online any time before you arrive. Please give at least {POLICIES.cancelWindowHours} hours' notice so someone else can have the time.
        </p>
        <p className="t-title" style={{ marginTop: 8 }}>
          Your details
        </p>
        <p className="muted">
          {SALON.name} uses your name, email and WhatsApp number only to confirm your bookings, remind you, and keep your visits and receipts together. We never sell them or
          share them for advertising. Ask the salon at any time to see or delete them.
        </p>
        <p className="muted">
          Read the full{" "}
          <a className="link" href="#/terms" target="_blank" rel="noreferrer">
            booking terms
          </a>{" "}
          and{" "}
          <a className="link" href="#/privacy" target="_blank" rel="noreferrer">
            privacy notice
          </a>
          .
        </p>
      </div>
    </Sheet>
  );
}
