/**
 * What's been typed into the log in / sign up forms so far, kept for this browser session.
 * Switching between the two forms keeps it, and screens that already know the visitor (from a
 * past booking) can prefill it. Passwords are never kept.
 */
export interface AuthDraft {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const DRAFT_KEY = "rh-auth-draft";
const EMPTY_DRAFT: AuthDraft = { email: "", firstName: "", lastName: "", phone: "" };

export function readAuthDraft(): AuthDraft {
  try {
    return { ...EMPTY_DRAFT, ...(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<AuthDraft>) };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveAuthDraft(patch: Partial<AuthDraft>) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...readAuthDraft(), ...patch }));
  } catch {
    /* storage blocked: the forms just start empty */
  }
}

/** Fills in details the app already knows, without overwriting anything typed. */
export function prefillAuthDraft(known: Partial<AuthDraft>) {
  const draft = readAuthDraft();
  const patch: Partial<AuthDraft> = {};
  for (const key of Object.keys(known) as (keyof AuthDraft)[]) {
    const value = known[key]?.trim();
    if (value && !draft[key]) patch[key] = value;
  }
  saveAuthDraft(patch);
}

export function clearAuthDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}
