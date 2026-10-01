import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ForgotForm, LoginForm, PasswordInput, SignUpForm } from "../components/AuthForms";
import { prefillAuthDraft } from "../data/authDraft";
import { photoSrcSet } from "../components/Bits";
import { LogoMark } from "../components/Brand";
import { Cta } from "../components/Button";
import { useNotify } from "../components/Notify";
import { auth } from "../data/auth";
import { SALON } from "../data/business";
import { accountOf, useAppData } from "../data/store";
import { AUTH_MESSAGE, safeNext, validateReset, type AuthErrorCode } from "../lib/auth";
import { enter } from "../motion";

/** Keeps `?next=` (where to go after signing in) when moving between the sign-in pages. */
function useNext() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const withNext = (path: string) => `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
  return { next, withNext };
}

/** Salon photos behind each page's top, so the sign-in screens feel like the salon's own. */
const PHOTOS = {
  login: { src: "/photos/barbershop-pole.webp", position: "center 45%" },
  signup: { src: "/photos/ombre-curls.webp", position: "center 35%" },
  password: { src: "/photos/decor-wall.webp", position: "center 40%" },
} as const;

function AuthShell({ variant, title, photo, children }: { variant: "brand" | "bar"; title?: string; photo: keyof typeof PHOTOS; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { next } = useNext();
  const shot = PHOTOS[photo];
  // Back goes to the previous screen, or to where the visitor was headed when they arrived by link.
  const back = () => (location.key !== "default" ? navigate(-1) : navigate(next === "/profile" ? "/" : next));
  return (
    <main className="auth">
      <div className="auth-card">
        <header className={`auth-top ${variant === "bar" ? "is-bar" : ""}`}>
          <img className="auth-photo" src={shot.src} srcSet={photoSrcSet(shot.src)} sizes="(min-width: 810px) 480px, 100vw" alt="" fetchPriority="high" style={{ objectPosition: shot.position }} />
          <button type="button" className="auth-back" onClick={back} aria-label="Back">
            <ArrowLeft size={22} strokeWidth={1.8} />
          </button>
          {variant === "bar" ? (
            <h1 className="auth-bar-title">{title}</h1>
          ) : (
            <>
              <span className="auth-brand" aria-hidden="true">
                <LogoMark size={40} />
              </span>
              <p className="auth-name">{SALON.name}</p>
              <p className="auth-tagline">{SALON.tagline}</p>
            </>
          )}
          {auth.kind === "demo" && (
            <span className="auth-demo-tag" title="Accounts in this preview are saved on this device only">
              Demo
            </span>
          )}
        </header>
        <motion.section className="auth-sheet" {...enter(16)}>
          {children}
        </motion.section>
      </div>
    </main>
  );
}

export function LoginPage() {
  const data = useAppData();
  const navigate = useNavigate();
  const { next, withNext } = useNext();
  if (accountOf(data)) return <Navigate to={next} replace />;
  return (
    <AuthShell variant="brand" photo="login">
      <div className="auth-head">
        <h1>Welcome back</h1>
        <p>Log in to see your bookings, visit history and receipts.</p>
      </div>
      <LoginForm onDone={() => navigate(next, { replace: true })} onSwitch={() => navigate(withNext("/signup"), { replace: true })} onForgot={() => navigate(withNext("/forgot-password"))} />
    </AuthShell>
  );
}

export function SignUpPage() {
  const data = useAppData();
  const navigate = useNavigate();
  const { next, withNext } = useNext();
  if (accountOf(data)) return <Navigate to={next} replace />;
  return (
    <AuthShell variant="bar" title="Create account" photo="signup">
      <div className="auth-head">
        <p>Keep your bookings, receipts and loyalty points in one place, on any phone.</p>
      </div>
      <SignUpForm onDone={() => navigate(next, { replace: true })} onSwitch={() => navigate(withNext("/login"), { replace: true })} />
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { withNext } = useNext();
  return (
    <AuthShell variant="bar" title="Forgot password" photo="password">
      <ForgotForm onBack={() => navigate(withNext("/login"), { replace: true })} onOpenLink={(link) => navigate(withNext(link), { replace: true })} />
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const { withNext } = useNext();
  const code = params.get("code") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<AuthErrorCode | null>(code ? null : "invalid-action-code");
  const [busy, setBusy] = useState(false);
  // Checked as the page opens, so a used or expired link says so before anything is typed.
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let live = true;
    auth.checkResetCode(code).then((result) => {
      if (!live) return;
      if ("error" in result) setFailure(result.error);
      else setEmail(result.email);
    });
    return () => {
      live = false;
    };
  }, [code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateReset({ password, confirm });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const result = await auth.resetPassword(code, password);
    setBusy(false);
    if ("error" in result) {
      setFailure(result.error);
      return;
    }
    prefillAuthDraft({ email: result.email });
    notify("Password changed", "Log in with your new password.");
    navigate(withNext("/login"), { replace: true });
  };

  const deadLink = failure === "invalid-action-code" || failure === "expired-action-code";

  return (
    <AuthShell variant="bar" title="New password" photo="password">
      {deadLink ? (
        <div className="auth-form">
          <p className="auth-alert" role="alert">
            {failure && AUTH_MESSAGE[failure]}
          </p>
          <Cta onClick={() => navigate(withNext("/forgot-password"), { replace: true })}>Send a new link</Cta>
        </div>
      ) : !email ? (
        <p className="muted" style={{ textAlign: "center" }} aria-busy="true">
          Checking your link…
        </p>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <p className="muted" style={{ textAlign: "center" }}>
            Choose a new password for <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{email}</strong>.
          </p>
          <PasswordInput id="reset-password" label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="At least 8 characters, with letters and a number." />
          <PasswordInput id="reset-confirm" label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
          {failure && (
            <p className="auth-alert" role="alert">
              {AUTH_MESSAGE[failure]}
            </p>
          )}
          <Cta type="submit" loading={busy}>
            Save new password
          </Cta>
        </form>
      )}
    </AuthShell>
  );
}
