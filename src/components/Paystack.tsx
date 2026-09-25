import { Check, CreditCard, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { SALON } from "../data/business";
import type { OnlinePayment } from "../data/store";
import { formatGhPhone, normalizeGhPhone } from "../lib/contact";
import { money } from "../lib/format";
import { spring } from "../motion";
import { Button, Dots } from "./Button";
import { Sheet } from "./Sheet";

const NETWORKS = ["MTN", "Telecel", "AirtelTigo"] as const;
type Network = (typeof NETWORKS)[number];
type Stage = "form" | "approve" | "card" | "verifying" | "failed" | "done";

interface PaystackSheetProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  /** What the money is for, e.g. "Deposit for RH-1042". */
  label: string;
  email: string;
  phone: string;
  /** Records the payment. Return an error message to show, or null when it went through. */
  onPaid: (payment: OnlinePayment) => string | null;
}

/**
 * Stand-in for Paystack's checkout (Mobile Money or card). In the live app this opens Paystack,
 * and the order is only marked paid after the server verifies the charge.
 */
export function PaystackSheet(props: PaystackSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Pay securely">
      <PaystackFlow {...props} />
    </Sheet>
  );
}

function PaystackFlow({ amount, label, email, phone, onPaid }: PaystackSheetProps) {
  const [channel, setChannel] = useState<"momo" | "card">("momo");
  const [network, setNetwork] = useState<Network>("MTN");
  const [number, setNumber] = useState(formatGhPhone(phone));
  const [numberError, setNumberError] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [failure, setFailure] = useState("");

  const payer = channel === "momo" ? `${network} MoMo · ${formatGhPhone(number)}` : "Card via Paystack";

  useEffect(() => {
    if (stage === "approve") {
      const t = window.setTimeout(() => setStage("verifying"), 3200);
      return () => window.clearTimeout(t);
    }
    if (stage === "card") {
      const t = window.setTimeout(() => setStage("verifying"), 1800);
      return () => window.clearTimeout(t);
    }
    if (stage === "verifying") {
      const t = window.setTimeout(() => {
        const error = onPaid({ amount, method: channel, payer });
        // "done" stops this effect from charging again while the sheet animates closed.
        if (error) {
          setFailure(error);
          setStage("failed");
        } else setStage("done");
      }, 1100);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [stage, amount, channel, payer, onPaid]);

  const start = () => {
    if (channel === "momo" && !normalizeGhPhone(number)) {
      setNumberError("Enter the Mobile Money number that will approve the payment.");
      return;
    }
    setStage(channel === "momo" ? "approve" : "card");
  };

  if (stage !== "form") {
    const content = {
      approve: {
        icon: <Smartphone size={26} />,
        title: "Approve on your phone",
        body: `We sent a payment prompt to ${formatGhPhone(number)} on ${network}. Enter your MoMo PIN to approve ${money(amount)}.`,
      },
      card: { icon: <CreditCard size={26} />, title: "Opening Paystack", body: "Enter your card details on Paystack's secure page." },
      verifying: { icon: <ShieldCheck size={26} />, title: "Confirming your payment", body: "Checking with Paystack. Keep this screen open." },
      failed: { icon: <Lock size={26} />, title: "Payment not completed", body: failure },
      done: { icon: <Check size={26} />, title: "Payment received", body: "Your receipt is ready." },
    }[stage];

    return (
      <div className="stack gap-16" aria-live="polite">
        <div className="pay-wait">
          <motion.span className={`pay-wait-icon ${stage === "failed" ? "is-failed" : ""}`} animate={stage === "failed" || stage === "done" ? { scale: 1 } : { scale: [1, 1.08, 1] }} transition={stage === "failed" || stage === "done" ? spring.small : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            {content.icon}
          </motion.span>
          <p className="t-title">{content.title}</p>
          <p className="muted" style={{ maxWidth: "34ch" }}>
            {content.body}
          </p>
          {stage !== "failed" && stage !== "done" && <Dots />}
        </div>
        {stage === "approve" && (
          <Button
            block
            onClick={() => {
              setFailure("No approval came through, so nothing was charged. Check the number and network, then try again.");
              setStage("failed");
            }}
          >
            I didn't get a prompt
          </Button>
        )}
        {stage === "failed" && (
          <div className="stack gap-8">
            <Button variant="dark" block onClick={() => setStage("form")}>
              Try again
            </Button>
            {channel === "momo" && (
              <Button
                block
                onClick={() => {
                  setChannel("card");
                  setStage("form");
                }}
              >
                Pay by card instead
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        start();
      }}
      noValidate
    >
      <div className="card card-pad stack gap-4" style={{ background: "var(--charcoal)", color: "#fff" }}>
        <p className="t-cap" style={{ color: "var(--white-75)" }}>
          Pay {SALON.name}
        </p>
        <p className="t-num">{money(amount)}</p>
        <p className="t-cap" style={{ color: "var(--white-75)" }}>
          {label} · receipt to {email}
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Payment method">
        <button type="button" role="radio" aria-checked={channel === "momo"} className={channel === "momo" ? "is-active" : ""} onClick={() => setChannel("momo")}>
          Mobile Money
        </button>
        <button type="button" role="radio" aria-checked={channel === "card"} className={channel === "card" ? "is-active" : ""} onClick={() => setChannel("card")}>
          Card
        </button>
      </div>

      {channel === "momo" ? (
        <>
          <div className="stack gap-8">
            <p className="t-cap muted">Network</p>
            <div className="chips" style={{ marginInline: 0, paddingInline: 0, flexWrap: "wrap" }} role="radiogroup" aria-label="Mobile Money network">
              {NETWORKS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={network === n} className={`chip ${network === n ? "is-active" : ""}`} onClick={() => setNetwork(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="momo-number">Mobile Money number</label>
            <input
              id="momo-number"
              inputMode="tel"
              autoComplete="tel-national"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setNumberError("");
              }}
              aria-invalid={Boolean(numberError)}
              aria-describedby="momo-number-hint"
            />
            <span id="momo-number-hint" className={numberError ? "error" : "hint"}>
              {numberError || "You'll get a prompt on this phone to enter your PIN."}
            </span>
          </div>
        </>
      ) : (
        <p className="info-line muted">
          <Lock size={16} />
          <span>You'll enter your card on Paystack's secure page. {SALON.name} never sees your card number.</span>
        </p>
      )}

      <Button variant="dark" block type="submit">
        Pay {money(amount)}
      </Button>
      <p className="inline t-cap subtle" style={{ justifyContent: "center", gap: 6 }}>
        <ShieldCheck size={14} /> Secured by Paystack · Demo: no money moves
      </p>
    </form>
  );
}
