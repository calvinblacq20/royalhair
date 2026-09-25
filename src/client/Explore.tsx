import { Heart, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Photo, Skeleton, useSkeleton } from "../components/Bits";
import { Reveal } from "../components/Reveal";
import { GROUP_LABEL, GROUPS, SERVICES } from "../data/catalog";
import { actions, useAppData } from "../data/store";
import type { ServiceGroup } from "../data/types";
import { durationLabel, priceLabel } from "../lib/pricing";
import { spring } from "../motion";

const isGroup = (value: string | null): value is ServiceGroup => GROUPS.some((g) => g.id === value);

export function Explore() {
  const loading = useSkeleton(500);
  const [params, setParams] = useSearchParams();
  const groupParam = params.get("group");
  const group = isGroup(groupParam) ? groupParam : null;
  const savedOnly = params.get("saved") === "1";
  const [query, setQuery] = useState("");
  const { savedServiceIds } = useAppData().device;
  const navigate = useNavigate();
  const menu = SERVICES.filter((s) => s.active !== false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter((s) => {
      if (savedOnly && !savedServiceIds.includes(s.id)) return false;
      if (group && s.group !== group) return false;
      if (!q) return true;
      return `${s.name} ${GROUP_LABEL[s.group]} ${s.description}`.toLowerCase().includes(q);
    });
  }, [query, group, savedOnly, savedServiceIds, menu]);

  const setFilter = (next: { group?: string | null; saved?: boolean }) => {
    const p = new URLSearchParams();
    const g = next.group === undefined ? group : next.group;
    const s = next.saved === undefined ? savedOnly : next.saved;
    if (g) p.set("group", g);
    if (s) p.set("saved", "1");
    setParams(p, { replace: true });
  };

  return (
    <main className="screen">
      <header className="page-title" style={{ paddingTop: 20 }}>
        <h1 className="t-h1">Explore</h1>
        <p className="muted">
          {menu.length} services · every price on the menu
        </p>
      </header>

      <div className="stack gap-12 explore-bar" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--ground)", marginInline: "calc(var(--gutter) * -1)", padding: "8px var(--gutter) 10px" }}>
        <label className="search-box">
          <Search size={18} className="subtle" />
          <span className="sr-only">Search services</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search braids, fade, pedicure…" inputMode="search" />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="subtle">
              <X size={18} />
            </button>
          )}
        </label>
        <div className="chips">
          <button className={`chip ${!group && !savedOnly ? "is-active" : ""}`} onClick={() => setFilter({ group: null, saved: false })}>
            All
          </button>
          <button className={`chip ${savedOnly ? "is-active" : ""}`} onClick={() => setFilter({ saved: !savedOnly })}>
            <Heart size={14} /> Saved
            <span className="chip-count">{savedServiceIds.length}</span>
          </button>
          {GROUPS.map((g) => (
            <button key={g.id} className={`chip ${group === g.id ? "is-active" : ""}`} onClick={() => setFilter({ group: group === g.id ? null : g.id })}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="style-grid" style={{ marginTop: 12 }} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="stack gap-8">
              <Skeleton h={190} r={8} />
              <Skeleton w="70%" h={14} />
              <Skeleton w="40%" h={12} />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Search size={24} />
          </span>
          <p className="t-title">{savedOnly ? "No saved services yet" : "No services match"}</p>
          <p className="muted">{savedOnly ? "Tap the heart on any service to keep it here." : "Try another word or clear the filters."}</p>
          <button
            className="btn btn-outline"
            onClick={() => {
              setQuery("");
              setFilter({ group: null, saved: false });
            }}
            style={{ marginTop: 8 }}
          >
            Show all services
          </button>
        </div>
      ) : (
        <motion.div layout className="style-grid" style={{ marginTop: 12 }}>
          <AnimatePresence mode="popLayout">
            {results.map((service, i) => {
              const saved = savedServiceIds.includes(service.id);
              return (
                <motion.div key={service.id} layout="position" exit={{ opacity: 0, scale: 0.96 }} transition={spring.small} className="style-tile">
                  <Reveal y={32} delay={(i % 4) * 0.06}>
                    <button onClick={() => navigate(`/book?service=${service.id}`)} className="stack gap-8" style={{ textAlign: "left", width: "100%" }} aria-label={`Book ${service.name}, ${priceLabel(service)}`}>
                      <Photo tone={service.tone} src={service.photo} alt={service.name} sizes="(min-width: 1200px) 290px, (min-width: 810px) 33vw, 50vw" ratio="4 / 5" radius="var(--r-img)" markSize={44} />
                      <span className="stack">
                        <span className="t-title" style={{ fontSize: 15 }}>
                          {service.name}
                        </span>
                        <span className="subtle t-cap">
                          {GROUP_LABEL[service.group]} · {durationLabel(service.minutes)}
                        </span>
                        <span className="tabular" style={{ fontWeight: 500 }}>
                          {priceLabel(service)}
                        </span>
                      </span>
                    </button>
                    <motion.button className={`icon-btn save ${saved ? "is-on" : ""}`} onClick={() => actions.toggleSaved(service.id)} aria-pressed={saved} aria-label={saved ? `Remove ${service.name} from saved` : `Save ${service.name}`} whileTap={{ scale: 0.8 }} transition={spring.press}>
                      <Heart size={16} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
                    </motion.button>
                  </Reveal>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </main>
  );
}
