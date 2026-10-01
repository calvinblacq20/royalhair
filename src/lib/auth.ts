import { normalizeGhPhone } from "./contact";

/*
 * Rules for logging in and creating an account, shared by the demo stand-in and (later) Firebase
 * Authentication. Error codes follow Firebase's names, so the messages below keep working when the
 * real service is connected. No DOM or storage here, so it is all unit tested.
 */

export type AuthErrorCode =
  | "invalid-email"
  | "missing-password"
  | "invalid-credential"
  | "email-already-in-use"
  | "phone-in-use"
  | "weak-password"
  | "too-many-requests"
  | "expired-action-code"
  | "invalid-action-code"
  | "popup-closed-by-user"
  | "network-request-failed";

export const AUTH_MESSAGE: Record<AuthErrorCode, string> = {
  "invalid-email": "Enter a valid email address, like ama@gmail.com.",
  "missing-password": "Enter your password.",
  "invalid-credential": "That email and password don't match. Check both, or reset your password.",
  "email-already-in-use": "This email already has an account. Log in instead.",
  "phone-in-use": "This WhatsApp number already has an account. Log in with its email instead.",
  "weak-password": "Use at least 8 characters, with letters and a number.",
  "too-many-requests": "Too many tries. Wait a minute, then try again.",
  "expired-action-code": "This reset link has expired. Ask for a new one.",
  "invalid-action-code": "This reset link has already been used or isn't valid. Ask for a new one.",
  "popup-closed-by-user": "Google sign-in was closed before it finished.",
  "network-request-failed": "No connection. Check your internet and try again.",
};

export const PASSWORD_MIN = 8;

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export function isEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(raw.trim());
}

/** Why a new password isn't good enough, or null when it is. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return "Mix letters with at least one number.";
  return null;
}

export interface LoginInput {
  email: string;
  password: string;
}
export type LoginErrors = Partial<Record<keyof LoginInput, string>>;

export function validateLogin({ email, password }: LoginInput): LoginErrors {
  const errors: LoginErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!isEmail(email)) errors.email = AUTH_MESSAGE["invalid-email"];
  if (!password) errors.password = AUTH_MESSAGE["missing-password"];
  return errors;
}

export interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  terms: boolean;
}
export type SignUpErrors = Partial<Record<keyof SignUpInput, string>>;

export function validateSignUp(input: SignUpInput): SignUpErrors {
  const errors: SignUpErrors = {};
  if (!input.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!input.lastName.trim()) errors.lastName = "Enter your last name.";
  if (!input.email.trim()) errors.email = "Enter your email address.";
  else if (!isEmail(input.email)) errors.email = AUTH_MESSAGE["invalid-email"];
  if (!normalizeGhPhone(input.phone)) errors.phone = "Enter a Ghana WhatsApp number, like 024 123 4567.";
  const weak = passwordProblem(input.password);
  if (weak) errors.password = weak;
  if (!input.confirm) errors.confirm = "Type your password again.";
  else if (input.confirm !== input.password) errors.confirm = "The passwords don't match.";
  if (!input.terms) errors.terms = "Accept the terms to create your account.";
  return errors;
}

export interface ResetInput {
  password: string;
  confirm: string;
}
export type ResetErrors = Partial<Record<keyof ResetInput, string>>;

export function validateReset({ password, confirm }: ResetInput): ResetErrors {
  const errors: ResetErrors = {};
  const weak = passwordProblem(password);
  if (weak) errors.password = weak;
  if (!confirm) errors.confirm = "Type your new password again.";
  else if (confirm !== password) errors.confirm = "The passwords don't match.";
  return errors;
}

export const fullName = (first: string, last: string) => [first, last].map((part) => part.trim()).filter(Boolean).join(" ");

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/**
 * Where to go after logging in. Only paths inside the app are allowed, so a crafted link can't
 * bounce someone to another site straight after they sign in.
 */
export function safeNext(raw: string | null | undefined, fallback = "/profile"): string {
  if (!raw) return fallback;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path) || /^\/[^/?#]*:/.test(path)) return fallback;
  // Never loop back into the sign-in pages themselves.
  if (/^\/(login|signup|forgot-password|reset-password)(\/|\?|$)/.test(path)) return fallback;
  return path;
}
