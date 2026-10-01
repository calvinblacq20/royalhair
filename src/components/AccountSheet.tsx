import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { prefillAuthDraft } from "../data/authDraft";
import { splitName } from "../lib/auth";
import { ForgotForm, LoginForm, SignUpForm } from "./AuthForms";
import { Sheet } from "./Sheet";

type AccountMode = "login" | "create" | "forgot";

/**
 * Log in or create an account without leaving the screen. Booking uses this so a half-filled
 * booking isn't lost; everywhere else links to the full /login and /signup pages. Same forms, same accounts.
 */
export function AccountSheet({ open, onClose, mode = "login", defaultName = "", defaultPhone = "", onDone }: {
  open: boolean;
  onClose: () => void;
  mode?: "login" | "create";
  defaultName?: string;
  defaultPhone?: string;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<AccountMode>(mode);
  // The forms read the shared draft when they mount, so they wait until it's been filled in.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setCurrent(mode);
    prefillAuthDraft({ ...splitName(defaultName), phone: defaultPhone });
    setReady(true);
  }, [open, mode, defaultName, defaultPhone]);

  const done = () => {
    onClose();
    onDone?.();
  };
  const title = current === "login" ? "Log in" : current === "create" ? "Create an account" : "Forgot password";

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {ready && current === "login" && <LoginForm onDone={done} onSwitch={() => setCurrent("create")} onForgot={() => setCurrent("forgot")} />}
      {ready && current === "create" && <SignUpForm onDone={done} onSwitch={() => setCurrent("login")} />}
      {ready && current === "forgot" && (
        <ForgotForm
          onBack={() => setCurrent("login")}
          onOpenLink={(link) => {
            onClose();
            navigate(link);
          }}
        />
      )}
    </Sheet>
  );
}
