import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

describe("crash screen", () => {
  it("shows the page as normal until something throws", () => {
    const boundary = new ErrorBoundary({ children: "the app" });
    expect(boundary.render()).toBe("the app");
  });

  it("after a crash, offers a reload and the salon's WhatsApp, with no error details", () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const boundary = new ErrorBoundary({ children: "the app" });
    boundary.state = { failed: true };
    const html = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Reload");
    expect(html).toContain("https://wa.me/233");
    expect(html).not.toMatch(/Error:|stack|at [A-Z]\w+ \(/);
  });
});
