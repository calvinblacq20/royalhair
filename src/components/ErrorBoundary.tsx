import { Component, type ErrorInfo, type ReactNode } from "react";
import { SALON } from "../data/business";
import { whatsappLink } from "../lib/contact";

interface State {
  failed: boolean;
}

/**
 * Last line of defence: if a screen throws while rendering, show a plain page with a way forward
 * instead of a blank white screen. The details go to the console (and to error tracking once it
 * is set up), never to the visitor.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen is-narrow" role="alert">
        <div className="empty" style={{ marginTop: "18vh" }}>
          <h1 className="t-h2">Something went wrong</h1>
          <p className="muted" style={{ maxWidth: "36ch" }}>
            This page didn't load properly. Your bookings are safe. Reload to try again, or message the salon and we'll sort it out.
          </p>
          <div className="inline" style={{ gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn btn-dark" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn btn-outline" href={whatsappLink(SALON.phone, `Hi ${SALON.name}, the website isn't loading for me.`)} target="_blank" rel="noreferrer">
              WhatsApp the salon
            </a>
          </div>
        </div>
      </main>
    );
  }
}
