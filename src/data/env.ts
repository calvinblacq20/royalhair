/**
 * The salon side (/#/admin) and the demo controls (reset, "Open the salon side").
 *
 * On while developing, and in a demo build made with VITE_SALON_SIDE=on (the version shown to the
 * salon). Off in a normal production build: there are no staff logins until the backend exists
 * (docs/decisions/0002-backend-and-hosting.md), so the salon side must not be reachable on the
 * live site.
 */
export const SALON_SIDE: boolean = import.meta.env.DEV || import.meta.env.VITE_SALON_SIDE === "on";
