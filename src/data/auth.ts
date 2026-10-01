import { fullName, normalizeEmail, passwordProblem, type AuthErrorCode } from "../lib/auth";
import { formatGhPhone } from "../lib/contact";
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD } from "./seed";
import { actions } from "./store";
import type { Customer } from "./types";

/*
 * Sign-in for the client app. Screens only talk to `auth` (the AuthService below), never to a
 * provider directly. Today it is a demo stand-in that keeps accounts on this device; connecting
 * Firebase Authentication later means writing a second AuthService with the same methods:
 *   signIn            -> signInWithEmailAndPassword (+ setPersistence local/session for "Remember me")
 *   signUp            -> createUserWithEmailAndPassword, then save name + WhatsApp number
 *   signInWithGoogle  -> signInWithPopup(GoogleAuthProvider)
 *   sendPasswordReset -> sendPasswordResetEmail
 *   resetPassword     -> confirmPasswordReset(oobCode)
 *   signOut           -> signOut
 * Error codes already use Firebase's names (see lib/auth.ts).
 */

export type AuthResult = { customer: Customer } | { error: AuthErrorCode };

export interface SignUpDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthService {
  /** "demo" until a real provider is connected; screens label the demo so nobody mistakes it. */
  readonly kind: "demo" | "firebase";
  signIn(email: string, password: string, remember: boolean): Promise<AuthResult>;
  signUp(details: SignUpDetails, remember: boolean): Promise<AuthResult>;
  signInWithGoogle(remember: boolean): Promise<AuthResult>;
  /** Always succeeds, so the form never reveals which emails have accounts. The demo returns the link its "inbox" shows. */
  sendPasswordReset(email: string): Promise<{ ok: true; demoLink: string | null }>;
  /** Checks a reset link before showing the form (Firebase: verifyPasswordResetCode). */
  checkResetCode(code: string): Promise<{ email: string } | { error: AuthErrorCode }>;
  resetPassword(code: string, password: string): Promise<{ ok: true; email: string } | { error: AuthErrorCode }>;
  signOut(): Promise<void>;
}

/* ---------------- Demo stand-in ---------------- */

interface StoredCredential {
  customerId: string;
  salt: string;
  hash: string;
}

const CREDENTIALS_KEY = "rh-demo-auth-v1";
const RESETS_KEY = "rh-demo-resets";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;
const RESET_TTL_MS = 30 * 60_000;
const PBKDF2_ROUNDS = 120_000;

/** Kept in memory and mirrored to storage when the browser allows it. */
const memory = new Map<string, string>();

function readJson<T>(key: string, fallback: T, store: () => Storage): T {
  try {
    const raw = store().getItem(key) ?? memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    const raw = memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  }
}

function writeJson(key: string, value: unknown, store: () => Storage) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    store().setItem(key, raw);
  } catch {
    /* storage blocked: the in-memory copy still works for this visit */
  }
}

const local = () => localStorage;
const session = () => sessionStorage;
const credentials = () => readJson<Record<string, StoredCredential>>(CREDENTIALS_KEY, {}, local);
const saveCredentials = (all: Record<string, StoredCredential>) => writeJson(CREDENTIALS_KEY, all, local);

const toHex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (length: number) => toHex(crypto.getRandomValues(new Uint8Array(length)));

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ROUNDS }, key, 256);
  return toHex(bits);
}

/** Compares every character, so the time taken doesn't hint at how much matched. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function setPassword(email: string, customerId: string, password: string) {
  const salt = randomHex(16);
  const all = credentials();
  all[normalizeEmail(email)] = { customerId, salt, hash: await hashPassword(password, salt) };
  saveCredentials(all);
}

/** The sample account works out of the box with its demo password. */
async function ensureDemoAccount() {
  if (credentials()[DEMO_ACCOUNT_EMAIL]) return;
  const customer = actions.customerForEmail(DEMO_ACCOUNT_EMAIL);
  if (customer) await setPassword(DEMO_ACCOUNT_EMAIL, customer.id, DEMO_ACCOUNT_PASSWORD);
}

const attempts = new Map<string, { failures: number; lockedUntil: number }>();

function lockedOut(email: string, now: number): boolean {
  const entry = attempts.get(email);
  return Boolean(entry && entry.lockedUntil > now);
}

function recordFailure(email: string, now: number) {
  const entry = attempts.get(email) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_ATTEMPTS) {
    entry.failures = 0;
    entry.lockedUntil = now + LOCK_MS;
  }
  attempts.set(email, entry);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDemoAuth(clock: () => number = Date.now, latency = 450): AuthService {
  return {
    kind: "demo",

    async signIn(rawEmail, password, remember) {
      await pause(latency);
      await ensureDemoAccount();
      const email = normalizeEmail(rawEmail);
      const now = clock();
      if (lockedOut(email, now)) return { error: "too-many-requests" };
      const credential = credentials()[email];
      // Hash even when there's no account, so a missing email takes as long as a wrong password.
      const hash = await hashPassword(password, credential?.salt ?? "no-account");
      if (!credential || !sameHash(hash, credential.hash)) {
        recordFailure(email, now);
        return { error: "invalid-credential" };
      }
      attempts.delete(email);
      const customer = actions.startSession(credential.customerId, remember);
      return customer ? { customer } : { error: "invalid-credential" };
    },

    async signUp(details, remember) {
      await pause(latency);
      await ensureDemoAccount();
      const email = normalizeEmail(details.email);
      if (passwordProblem(details.password)) return { error: "weak-password" };
      if (credentials()[email] || actions.customerForEmail(email)?.hasAccount) return { error: "email-already-in-use" };
      if (actions.customerForPhone(details.phone)?.hasAccount) return { error: "phone-in-use" };
      // A guest who booked with this number keeps their visits: their record becomes the account.
      const customer = actions.createAccount({ name: fullName(details.firstName, details.lastName), phone: formatGhPhone(details.phone), email });
      await setPassword(email, customer.id, details.password);
      const signedIn = actions.startSession(customer.id, remember);
      return signedIn ? { customer: signedIn } : { error: "network-request-failed" };
    },

    async signInWithGoogle(remember) {
      // Stand-in for Google's sign-in window: signs in the sample account's Gmail address.
      await pause(latency * 2.5);
      await ensureDemoAccount();
      const customer = actions.customerForEmail(DEMO_ACCOUNT_EMAIL);
      const signedIn = customer ? actions.startSession(customer.id, remember) : null;
      return signedIn ? { customer: signedIn } : { error: "popup-closed-by-user" };
    },

    async sendPasswordReset(rawEmail) {
      await pause(latency);
      await ensureDemoAccount();
      const email = normalizeEmail(rawEmail);
      const customer = actions.customerForEmail(email);
      if (!customer?.hasAccount) return { ok: true, demoLink: null };
      const code = randomHex(16);
      const resets = readJson<Record<string, { email: string; customerId: string; expiresAt: number }>>(RESETS_KEY, {}, session);
      resets[code] = { email, customerId: customer.id, expiresAt: clock() + RESET_TTL_MS };
      writeJson(RESETS_KEY, resets, session);
      return { ok: true, demoLink: `/reset-password?code=${code}` };
    },

    async checkResetCode(code) {
      await pause(latency / 2);
      const entry = readJson<Record<string, { email: string; customerId: string; expiresAt: number }>>(RESETS_KEY, {}, session)[code];
      if (!entry) return { error: "invalid-action-code" };
      if (entry.expiresAt < clock()) return { error: "expired-action-code" };
      return { email: entry.email };
    },

    async resetPassword(code, password) {
      await pause(latency);
      if (passwordProblem(password)) return { error: "weak-password" };
      const resets = readJson<Record<string, { email: string; customerId: string; expiresAt: number }>>(RESETS_KEY, {}, session);
      const entry = resets[code];
      if (!entry) return { error: "invalid-action-code" };
      delete resets[code];
      writeJson(RESETS_KEY, resets, session);
      if (entry.expiresAt < clock()) return { error: "expired-action-code" };
      await setPassword(entry.email, entry.customerId, password);
      attempts.delete(entry.email);
      return { ok: true, email: entry.email };
    },

    async signOut() {
      actions.logOut();
    },
  };
}

/** The sign-in service every screen uses. Swap for a Firebase-backed AuthService when it's connected. */
export const auth: AuthService = createDemoAuth();
