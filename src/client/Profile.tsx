import { LayoutDashboard, LogOut, MapPin, RotateCcw, ShieldCheck, Smartphone, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, SectionHead } from "../components/Bits";
import { Button } from "../components/Button";
import { useNotify } from "../components/Notify";
import { Sheet } from "../components/Sheet";
import { branchById, SALON } from "../data/business";
import { accessOf, accountOf, actions, useAppData } from "../data/store";
import { CODE_MESSAGE, visibleVisits } from "../lib/checkout";
import { formatGhPhone, normalizeGhPhone } from "../lib/contact";
import { fmtDate, money } from "../lib/format";
import { paidTotal } from "../lib/visits";

export function Profile() {
  const data = useAppData();
  const notify = useNotify();
  const account = accountOf(data);
  const [signInOpen, setSignInOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const visits = visibleVisits(data.visits, accessOf(data));
  const spent = visits.reduce((sum, v) => sum + paidTotal(v), 0);
  const favourite = account?.hair?.preferredBranchId ? branchById(account.hair.preferredBranchId) : data.device.branchId ? branchById(data.device.branchId) : undefined;

  return (
    <main className="screen">
      <h1 className="t-h1 page-title">Profile</h1>

      {account ? (
        <section className="card card-pad account-card stack gap-12">
          <div className="inline gap-12">
            <Avatar name={account.name} size={52} />
            <div className="stack gap-4">
              <p className="t-title">{account.name}</p>
              <p className="muted t-cap">
                {formatGhPhone(account.phone)} · member since {fmtDate(new Date(account.memberSince))}
              </p>
            </div>
          </div>
          <div className="stat-row">
            <div className="stack gap-4">
              <span className="subtle t-cap">Points</span>
              <span className="t-title tabular">{account.points}</span>
            </div>
            <div className="stack gap-4">
              <span className="subtle t-cap">Visits</span>
              <span className="t-title tabular">{visits.length}</span>
            </div>
            <div className="stack gap-4">
              <span className="subtle t-cap">Spent</span>
              <span className="t-title tabular">{money(spent)}</span>
            </div>
          </div>
          <div className="account-card-actions">
            <Button
              size="sm"
              icon={<LogOut size={15} />}
              onClick={() => {
                actions.logOut();
                notify("Signed out", "Your visits stay safe in your account.");
              }}
            >
              Sign out
            </Button>
          </div>
        </section>
      ) : (
        <section className="card card-pad stack gap-12">
          <p className="t-title">Keep your visits on any phone</p>
          <p className="muted">
            Sign in with your WhatsApp number. No password. Your bookings, receipts and points follow you,
            and your stylist's notes are there next time.
          </p>
          <div>
            <Button variant="dark" icon={<Smartphone size={16} />} onClick={() => setSignInOpen(true)}>
              Sign in with WhatsApp
            </Button>
          </div>
        </section>
      )}

      <section className="section">
        <SectionHead title="Your salon" />
        <div className="card list-card">
          <Link className="row" to="/branches">
            <span className="row-icon" aria-hidden="true">
              <MapPin size={18} strokeWidth={1.8} />
            </span>
            <span className="grow stack gap-4">
              <span>{favourite ? favourite.name : "Branches & hours"}</span>
              <span className="subtle t-cap">{favourite ? favourite.address : "Addresses, hours and numbers"}</span>
            </span>
          </Link>
          <a className="row" href={SALON.instagram} target="_blank" rel="noreferrer">
            <span className="row-icon" aria-hidden="true">
              <Star size={18} strokeWidth={1.8} />
            </span>
            <span className="grow stack gap-4">
              <span>Follow our work</span>
              <span className="subtle t-cap">Instagram @royalhair_gh</span>
            </span>
          </a>
        </div>
      </section>

      <section className="section">
        <SectionHead title="This phone" />
        <div className="card list-card">
          <button
            className="row"
            onClick={() => {
              actions.forgetDevice();
              notify("Forgotten", "Your details and bookings are no longer saved on this phone.");
            }}
          >
            <span className="row-icon" aria-hidden="true">
              <ShieldCheck size={18} strokeWidth={1.8} />
            </span>
            <span className="grow stack gap-4">
              <span>Forget this phone</span>
              <span className="subtle t-cap">Clears saved details. Nothing is deleted from the salon's records.</span>
            </span>
          </button>
        </div>
      </section>

      <section className="section">
        <SectionHead title="Demo" />
        <div className="card list-card">
          <Link className="row" to="/admin">
            <span className="row-icon" aria-hidden="true">
              <LayoutDashboard size={18} strokeWidth={1.8} />
            </span>
            <span className="grow stack gap-4">
              <span>Open the salon side</span>
              <span className="subtle t-cap">What the front desk and the owner see</span>
            </span>
          </Link>
          <button className="row" onClick={() => setResetOpen(true)}>
            <span className="row-icon" aria-hidden="true">
              <RotateCcw size={18} strokeWidth={1.8} />
            </span>
            <span className="grow stack gap-4">
              <span>Reset demo data</span>
              <span className="subtle t-cap">Puts every booking, price and client back to the start</span>
            </span>
          </button>
        </div>
      </section>

      <SignInSheet open={signInOpen} onClose={() => setSignInOpen(false)} notify={notify} />

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Reset the demo?">
        <div className="stack gap-12">
          <p className="muted">This clears everything you've changed and loads the sample salon again.</p>
          <Button
            variant="danger"
            block
            onClick={() => {
              actions.resetDemo();
              setResetOpen(false);
              notify("Demo reset", "Everything is back to the starting data.");
            }}
          >
            Reset
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

function SignInSheet({ open, onClose, notify }: { open: boolean; onClose: () => void; notify: (title: string, body: string) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");

  const close = () => {
    onClose();
    setStage("phone");
    setCode("");
    setError("");
  };

  const send = () => {
    if (!normalizeGhPhone(phone)) {
      setError("Enter a Ghana WhatsApp number, like 024 123 4567.");
      return;
    }
    const sent = actions.sendCode(phone);
    notify("Your sign-in code", `Code ${sent}. It expires in 10 minutes.`);
    setStage("code");
    setError("");
  };

  const verify = () => {
    const result = actions.checkCode(phone, code);
    if (result !== "ok") {
      setError(CODE_MESSAGE[result]);
      return;
    }
    const existing = actions.logIn(phone);
    const account = existing ?? actions.createAccount({ name: name.trim() || "Royal Hair client", phone });
    notify(existing ? "Welcome back" : "Account created", `Signed in as ${account.name}.`);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title="Sign in with WhatsApp">
      {stage === "phone" ? (
        <div className="stack gap-12">
          <label className="field">
            <span>WhatsApp number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="024 123 4567" />
          </label>
          <label className="field">
            <span>Your name (only needed the first time)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="dark" block onClick={send}>
            Send me a code
          </Button>
          <p className="subtle t-cap">Demo tip: 024 501 2233 is a sample client with visits and a hair record.</p>
        </div>
      ) : (
        <div className="stack gap-12">
          <p className="muted">Enter the 6-digit code we sent to {formatGhPhone(phone)}.</p>
          <label className="field">
            <span>Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="dark" block onClick={verify}>
            Sign in
          </Button>
          <button className="link hit" onClick={send}>
            Send a new code
          </button>
        </div>
      )}
    </Sheet>
  );
}
