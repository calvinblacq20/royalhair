import { MotionConfig } from "motion/react";
import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Link, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Skeleton } from "./components/Bits";
import { DesktopFooter, DesktopNav, TabBar } from "./components/Chrome";
import { NotifyProvider } from "./components/Notify";
import { Splash } from "./components/Overlays";
import { SmoothScroll, useScrollTo } from "./components/Scroll";
import { Explore } from "./client/Explore";
import { Home } from "./client/Home";
import { Visits } from "./client/Visits";
import { Profile } from "./client/Profile";
import { motionMode } from "./motion";

// Deeper screens load on demand to keep the first download small on mobile data.
const BookFlow = lazy(() => import("./client/BookFlow").then((m) => ({ default: m.BookFlow })));
const VisitDetail = lazy(() => import("./client/VisitDetail").then((m) => ({ default: m.VisitDetail })));
const ReceiptPage = lazy(() => import("./client/Receipt").then((m) => ({ default: m.ReceiptPage })));
const Branches = lazy(() => import("./client/Branches").then((m) => ({ default: m.Branches })));
const Privacy = lazy(() => import("./client/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./client/Legal").then((m) => ({ default: m.Terms })));
// The owner side is its own download; clients never fetch it.
// Left out of production builds until staff logins exist (src/data/env.ts). The condition is
// written out here, not imported, so the build can drop the salon side's code entirely.
const AdminApp =
  import.meta.env.DEV || import.meta.env.VITE_SALON_SIDE === "on" ? lazy(() => import("./admin/AdminApp").then((m) => ({ default: m.AdminApp }))) : null;

function ScreenFallback() {
  return (
    <main className="screen" aria-busy="true" style={{ paddingTop: 72 }}>
      <Skeleton w="55%" h={30} />
      <Skeleton h={160} r={8} style={{ marginTop: 20 }} />
      <Skeleton h={120} r={8} style={{ marginTop: 12 }} />
    </main>
  );
}

function AdminFallback() {
  return (
    <main aria-busy="true" style={{ padding: "72px 16px", maxWidth: 1240, margin: "0 auto" }}>
      <Skeleton w="30%" h={40} />
      <Skeleton h={320} r={8} style={{ marginTop: 20 }} />
    </main>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const scrollTo = useScrollTo();
  useEffect(() => {
    scrollTo(0, { immediate: true });
  }, [pathname, scrollTo]);
  return null;
}

/** Main tabs: bottom tab bar on phones, floating top nav and footer on wider screens. */
function TabsLayout() {
  return (
    <>
      <div className="page-surface">
        <DesktopNav />
        <Outlet />
      </div>
      <DesktopFooter />
      <TabBar />
    </>
  );
}

/** Detail pages: no tab bar on phones, top nav and footer on wider screens. */
function NavLayout() {
  return (
    <>
      <div className="page-surface">
        <DesktopNav />
        <Outlet />
      </div>
      <DesktopFooter />
    </>
  );
}

function NotFound() {
  return (
    <main className="screen is-narrow">
      <div className="empty" style={{ marginTop: "20vh" }}>
        <h1 className="t-h2">Page not found</h1>
        <p className="muted">This link doesn't lead anywhere in the salon app.</p>
        <Link className="btn btn-dark" to="/" style={{ marginTop: 12 }}>
          Go to home
        </Link>
      </div>
    </main>
  );
}

/** The client side keeps the smooth scrolling; the owner's work screens use native scrolling. */
function ClientApp() {
  return (
    <SmoothScroll>
      <ScrollToTop />
      <div className="app">
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route element={<TabsLayout />}>
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="services" element={<Explore />} />
              <Route path="visits" element={<Visits />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="book" element={<BookFlow />} />
            <Route element={<NavLayout />}>
              <Route path="visits/:visitId" element={<VisitDetail />} />
              <Route path="visits/:visitId/receipts/:paymentId" element={<ReceiptPage />} />
              <Route path="branches" element={<Branches />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </div>
    </SmoothScroll>
  );
}

export function App() {
  // Motion follows the mode index.html resolved (data-motion), not the media query, so JS and CSS
  // agree and ?motion= overrides reach the animations too. Calm drops slides, zooms and parallax
  // but keeps fades; off renders every state immediately.
  const mode = motionMode();
  return (
    <MotionConfig reducedMotion={mode === "full" ? "never" : "always"} transition={mode === "off" ? { duration: 0 } : undefined}>
      <HashRouter>
        <NotifyProvider>
          <Splash />
          <Routes>
            {AdminApp && (
              <Route
                path="admin/*"
                element={
                  <Suspense fallback={<AdminFallback />}>
                    <AdminApp />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<ClientApp />} />
          </Routes>
        </NotifyProvider>
      </HashRouter>
    </MotionConfig>
  );
}
