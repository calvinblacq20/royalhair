import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Photo, SectionHead } from "../components/Bits";
import { Reveal } from "../components/Reveal";
import { GROUPS, SERVICES } from "../data/catalog";
import type { ServiceGroup } from "../data/types";
import { durationLabel, priceLabel } from "../lib/pricing";

type Filter = ServiceGroup | "all";

const isGroup = (value: string | null): value is ServiceGroup => GROUPS.some((g) => g.id === value);

/** The price list Royal Hair has never published. It is the reason this site exists. */
export function Services() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const groupParam = params.get("group");
  const filter: Filter = isGroup(groupParam) ? groupParam : "all";

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SERVICES.filter((service) => {
      if (service.active === false) return false;
      if (filter !== "all" && service.group !== filter) return false;
      if (!needle) return true;
      return `${service.name} ${service.description}`.toLowerCase().includes(needle);
    });
  }, [filter, query]);

  const groups = filter === "all" ? GROUPS : GROUPS.filter((g) => g.id === filter);

  return (
    <main className="screen">
      <Reveal as="h1" className="t-h1 page-title">
        Services &amp; prices
      </Reveal>
      <Reveal as="p" className="t-lead" delay={0.05}>
        Every price includes the finish. Longer hair, extra length or a bigger set is quoted at the
        chair before we start, never after.
      </Reveal>

      <div className="search-box">
        <Search size={18} strokeWidth={1.8} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search braids, pedicure, fade…"
          aria-label="Search services"
        />
      </div>

      <div className="chips hscroll" role="group" aria-label="Filter by type">
        <button className={`chip ${filter === "all" ? "is-active" : ""}`} onClick={() => setParams({})} aria-pressed={filter === "all"}>
          Everything
          <span className="chip-count">{SERVICES.filter((s) => s.active !== false).length}</span>
        </button>
        {GROUPS.map((group) => {
          const count = SERVICES.filter((s) => s.group === group.id && s.active !== false).length;
          return (
            <button
              key={group.id}
              className={`chip ${filter === group.id ? "is-active" : ""}`}
              onClick={() => setParams({ group: group.id })}
              aria-pressed={filter === group.id}
            >
              {group.label}
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {results.length === 0 ? (
        <div className="empty">
          <p className="t-title">Nothing matches "{query}"</p>
          <p className="muted">Try "braids", "pedicure" or "fade", or message us and we'll tell you if we do it.</p>
        </div>
      ) : (
        groups.map((group) => {
          const inGroup = results.filter((s) => s.group === group.id);
          if (!inGroup.length) return null;
          return (
            <section key={group.id} className="section">
              <SectionHead title={group.label} action={<span className="subtle t-cap">{group.blurb}</span>} />
              <div className="card list-card">
                {inGroup.map((service) => (
                  <Link key={service.id} className="row service-row" to={`/book?service=${service.id}`}>
                    {service.photo && <Photo tone={service.tone} src={service.photo} alt="" ratio="1 / 1" radius={10} markSize={18} sizes="56px" className="service-thumb is-lg" />}
                    <span className="grow stack gap-4">
                      <span className="t-title">{service.name}</span>
                      <span className="muted t-cap clamp-3">{service.description}</span>
                      <span className="subtle t-cap">
                        {durationLabel(service.minutes)}
                        {service.repeatWeeks > 0 && ` · repeat every ${service.repeatWeeks} weeks`}
                        {!service.bookable && " · book by phone"}
                      </span>
                    </span>
                    <span className="stack gap-4 service-price">
                      <span className="t-title tabular">{priceLabel(service)}</span>
                      <ArrowRight size={16} strokeWidth={1.8} className="row-chevron" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}

      <p className="subtle t-cap price-note">
        Prices are for the service as described. Hair extensions and products you take home are charged separately.
      </p>
    </main>
  );
}
