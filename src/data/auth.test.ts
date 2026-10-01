import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoAuth } from "./auth";
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD, DEMO_ACCOUNT_PHONE } from "./seed";

// Every sign-in hashes the password 120,000 times, as a real auth server would, so a test that
// signs in eight times can pass five seconds on a busy machine. The time limit is generous, not the code.
vi.setConfig({ testTimeout: 20_000 });
import { actions, getAppData } from "./store";

let now = 1_000_000;
const auth = createDemoAuth(() => now, 0);
const newcomer = (tag: string) => ({ firstName: "Ama", lastName: "Mensah", email: `ama.${tag}@gmail.com`, phone: `020 ${String(Math.floor(100 + Math.random() * 899))} ${String(Math.floor(1000 + Math.random() * 8999))}`, password: "Kente2026" });

beforeEach(() => {
  now += 10 * 60_000;
  actions.logOut();
});

describe("demo sign-in", () => {
  it("logs the sample account in with its demo password", async () => {
    const result = await auth.signIn(` ${DEMO_ACCOUNT_EMAIL.toUpperCase()} `, DEMO_ACCOUNT_PASSWORD, true);
    expect("customer" in result && result.customer.email).toBe(DEMO_ACCOUNT_EMAIL);
    expect(getAppData().session).toEqual({ customerId: "c-naa" });
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    expect(await auth.signIn(DEMO_ACCOUNT_EMAIL, "wrong-pass1", true)).toEqual({ error: "invalid-credential" });
    expect(await auth.signIn("nobody@gmail.com", "Kente2026", true)).toEqual({ error: "invalid-credential" });
    expect(getAppData().session.customerId).toBeNull();
  });

  it("locks an email for a minute after five wrong tries", async () => {
    const email = "locked.out@gmail.com";
    await auth.signUp({ ...newcomer("lock"), email }, true);
    await auth.signOut();
    for (let i = 0; i < 5; i++) await auth.signIn(email, "Wrong-pass9", true);
    expect(await auth.signIn(email, "Kente2026", true)).toEqual({ error: "too-many-requests" });
    now += 61_000;
    expect("customer" in (await auth.signIn(email, "Kente2026", true))).toBe(true);
  });

  it("keeps a 'don't remember me' sign-in to this browser session", async () => {
    await auth.signIn(DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD, false);
    expect(getAppData().session).toEqual({ customerId: "c-naa", transient: true });
  });
});

describe("demo sign-up", () => {
  it("creates an account, signs in, and can log in again", async () => {
    const details = newcomer("new");
    const created = await auth.signUp(details, true);
    expect("customer" in created && created.customer.name).toBe("Ama Mensah");
    await auth.signOut();
    expect("customer" in (await auth.signIn(details.email, details.password, true))).toBe(true);
  });

  it("refuses an email or WhatsApp number that already has an account", async () => {
    expect(await auth.signUp({ ...newcomer("dup"), email: DEMO_ACCOUNT_EMAIL }, true)).toEqual({ error: "email-already-in-use" });
    expect(await auth.signUp({ ...newcomer("phone"), phone: DEMO_ACCOUNT_PHONE }, true)).toEqual({ error: "phone-in-use" });
  });

  it("refuses a weak password even if the form was skipped", async () => {
    expect(await auth.signUp({ ...newcomer("weak"), password: "short" }, true)).toEqual({ error: "weak-password" });
  });
});

describe("demo password reset", () => {
  it("never reveals whether an email has an account", async () => {
    expect(await auth.sendPasswordReset("stranger@gmail.com")).toEqual({ ok: true, demoLink: null });
  });

  it("resets with a one-time link, then the new password works", async () => {
    const details = newcomer("reset");
    await auth.signUp(details, true);
    await auth.signOut();
    const sent = await auth.sendPasswordReset(details.email);
    const code = sent.demoLink?.split("code=")[1] ?? "";
    expect(code).toHaveLength(32);
    expect(await auth.checkResetCode(code)).toEqual({ email: details.email });
    expect(await auth.checkResetCode("not-a-real-code")).toEqual({ error: "invalid-action-code" });
    expect(await auth.resetPassword(code, "NewKente2027")).toEqual({ ok: true, email: details.email });
    expect(await auth.checkResetCode(code)).toEqual({ error: "invalid-action-code" });
    expect(await auth.resetPassword(code, "NewKente2027")).toEqual({ error: "invalid-action-code" });
    expect("customer" in (await auth.signIn(details.email, "NewKente2027", true))).toBe(true);
  });

  it("expires reset links after 30 minutes", async () => {
    const sent = await auth.sendPasswordReset(DEMO_ACCOUNT_EMAIL);
    now += 31 * 60_000;
    expect(await auth.resetPassword(sent.demoLink?.split("code=")[1] ?? "", "NewKente2027")).toEqual({ error: "expired-action-code" });
  });
});
