import { ArrowRight, Baby, Clock, Flower2, Hand, MapPin, Scissors, Sparkles, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Photo, SectionHead, Stars } from "../components/Bits";
import { Wordmark } from "../components/Brand";
import { Cta } from "../components/Button";
import { Reveal } from "../components/Reveal";
import { BRANCHES, SALON } from "../data/business";
import { fromPrice, GROUP_PHOTO, GROUPS, ROLE_LABEL, SERVICES } from "../data/catalog";
import { useAppData } from "../data/store";
import type { ServiceGroup, Tone } from "../data/types";
import { openingOn } from "../lib/booking";
import { formatGhPhone, telLink, whatsappLink } from "../lib/contact";
import { fmtTime, money } from "../lib/format";
import { durationLabel, priceLabel } from "../lib/pricing";

const GROUP_LOOK: Record<ServiceGroup, { icon: LucideIcon; tone: string }> = {
  hair: { icon: Sparkles, tone: "magenta" },
  barbering: { icon: Scissors, tone: "ink" },
  nails: { icon: Hand, tone: "blush" },
  spa: { icon: Flower2, tone: "sage" },
  kids: { icon: Baby, tone: "champagne" },
};

/** The salon as it looks: stills from its own TikTok posts, in the order they tell the story. */
const GALLERY = [
  { src: "/photos/salon-floor.webp", caption: "The salon floor" },
  { src: "/photos/fade-detail.webp", caption: "A clean fade" },
  { src: "/photos/ombre-curls.webp", caption: "Colour and curls" },
  { src: "/photos/locs.webp", caption: "Locs" },
  { src: "/photos/nail-bar.webp", caption: "The nail bar" },
  { src: "/photos/blonde-cut.webp", caption: "Colour and cut" },
  { src: "/photos/nails-floral.webp", caption: "Nail art" },
  { src: "/photos/kids-braids.webp", caption: "Kids' braids" },
  { src: "/photos/pedicure.webp", caption: "Pedicure" },
  { src: "/photos/boutique.webp", caption: "Products to take home" },
];

const STEPS = [
  { title: "Pick your service", body: "Every price and how long it takes is on the list. No guessing, no asking." },
  { title: "Choose your barber or stylist", body: "Book the person you always sit with, or take whoever is free first." },
  { title: "Hold it with a deposit", body: "A small deposit keeps your chair. It comes off your bill on the day." },
];

function OpenLine({ now }: { now: Date }) {
  const open = BRANCHES.filter((branch) => {
    const hours = openingOn(branch, now);
    return hours && now >= hours.start && now < hours.end;
  });
  if (!open.length) {
    const next = BRANCHES.map((b) => openingOn(b, now)).find(Boolean);
    return <span className="subtle">Closed now{next ? ` · opens ${fmtTime(next.start)}` : ""}</span>;
  }
  return (
    <span className="is-open">
      Open now at {open.map((b) => b.name).join(", ")}
    </span>
  );
}

/** Wide screens only: the logo as it appears on their own channels, and which branch is open right now. */
function HeroAside({ now, onBook }: { now: Date; onBook: () => void }) {
  return (
    <aside className="hero-aside" aria-label="Branches today">
      <Wordmark on="dark" width={320} eager className="hero-aside-logo" />
      <ul className="hero-branches">
        {BRANCHES.filter((b) => b.active).map((branch) => {
          const hours = openingOn(branch, now);
          const open = hours !== null && now >= hours.start && now < hours.end;
          return (
            <li key={branch.id}>
              <span className={`hero-dot ${open ? "is-open" : ""}`} aria-hidden="true" />
              <span className="grow stack">
                <span className="t-title">{branch.name}</span>
                <span className="t-cap hero-branch-hours">
                  {hours ? (open ? `Open · closes ${fmtTime(hours.end)}` : now < hours.start ? `Opens ${fmtTime(hours.start)}` : "Closed for today") : "Closed today"}
                </span>
              </span>
              <a className="t-cap hero-branch-phone" href={telLink(branch.phone)}>
                {formatGhPhone(branch.phone)}
              </a>
            </li>
          );
        })}
      </ul>
      <Cta tone="magenta" onClick={onBook}>
        Book a visit
      </Cta>
    </aside>
  );
}

export function Home() {
  const data = useAppData();
  const navigate = useNavigate();
  const now = new Date();
  const featured = SERVICES.filter((s) => s.featured && s.active !== false).slice(0, 6);
  const reviews = data.reviews.filter((r) => r.status === "published").slice(0, 3);
  const rating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 5;

  return (
    <main className="screen">
      <div className="home-top">
      <section className="home-hero">
        <Wordmark width={220} eager className="home-logo" />
        <Reveal as="h1" className="t-h1">
          Barbershop, salon and spa. The price is on the door.
        </Reveal>
        <Reveal as="p" className="t-lead" delay={0.05}>
          Cuts and shape-ups, braids and relaxers, nails and massage, across three branches in Accra and
          Kumasi. See what everything costs, pick your barber or stylist, and book the chair in a minute.
        </Reveal>
        <Reveal className="inline gap-8 t-cap" delay={0.1}>
          <Clock size={14} strokeWidth={1.8} />
          <OpenLine now={now} />
        </Reveal>
        <Reveal className="hero-actions-row" delay={0.15}>
          <Cta onClick={() => navigate("/book")}>Book a visit</Cta>
          <Link className="btn btn-outline" to="/services">
            See all prices
          </Link>
        </Reveal>
      </section>
        <HeroAside now={now} onBook={() => navigate("/book")} />
      </div>

      <section className="section">
        <SectionHead title="What we do" action={<Link className="link" to="/services">All services</Link>} />
        <div className="group-grid">
          {GROUPS.map((group) => {
            const { icon: Icon, tone } = GROUP_LOOK[group.id];
            return (
            <Link key={group.id} className="group-card" to={`/services?group=${group.id}`}>
              {GROUP_PHOTO[group.id] ? (
                <Photo
                  tone={tone as Tone}
                  src={GROUP_PHOTO[group.id].src}
                  alt={GROUP_PHOTO[group.id].alt}
                  ratio="4 / 5"
                  radius="var(--r-16)"
                  sizes="(min-width: 1024px) 20vw, (min-width: 810px) 33vw, 50vw"
                  className="group-photo"
                />
              ) : (
                <span className={`group-tile tone-${tone}`} aria-hidden="true">
                  <Icon size={30} strokeWidth={1.5} />
                </span>
              )}
              <div className="stack gap-4">
                <p className="t-title">{group.label}</p>
                <p className="muted t-cap">{group.blurb}</p>
                <p className="t-cap">from {money(fromPrice(group.id))}</p>
              </div>
            </Link>
            );
          })}
        </div>
      </section>

      <section className="section">
        <SectionHead title="Booked most often" action={<Link className="link" to="/services">Full price list</Link>} />
        <div className="card list-card">
          {featured.map((service) => (
            <Link key={service.id} className="row" to={`/book?service=${service.id}`}>
              {service.photo ? (
                <Photo tone={service.tone} src={service.photo} ratio="1 / 1" radius={10} markSize={18} sizes="48px" className="service-thumb" />
              ) : (
                <span className="row-icon" aria-hidden="true">
                  <Sparkles size={18} strokeWidth={1.8} />
                </span>
              )}
              <span className="grow stack gap-4">
                <span className="t-title">{service.name}</span>
                <span className="subtle t-cap">{durationLabel(service.minutes)}</span>
              </span>
              <span className="tabular">{priceLabel(service)}</span>
              <ArrowRight size={16} strokeWidth={1.8} className="row-chevron" />
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead title="Three branches" action={<Link className="link" to="/branches">Addresses &amp; hours</Link>} />
        <div className="branch-grid">
          {BRANCHES.filter((b) => b.active).map((branch) => {
            const hours = openingOn(branch, now);
            return (
              <Link key={branch.id} className="card card-pad stack gap-8 branch-card" to="/branches">
                <span className="row-icon" aria-hidden="true">
                  <MapPin size={18} strokeWidth={1.8} />
                </span>
                <span className="t-title">{branch.name}</span>
                <span className="muted t-cap">{branch.address}</span>
                <span className="subtle t-cap">
                  {hours ? `Today ${fmtTime(hours.start)}–${fmtTime(hours.end)}` : "Closed today"} · {branch.chairs} chairs
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section">
        <SectionHead
          title="Inside Royal Hair"
          action={
            <a className="link" href={SALON.instagram} target="_blank" rel="noreferrer">
              More on Instagram
            </a>
          }
        />
        <ul className="gallery hscroll" aria-label="Photos from the salon">
          {GALLERY.map((item) => (
            <li key={item.src} className="gallery-item">
              <Photo tone="blush" src={item.src} alt={item.caption} ratio="3 / 4" radius="var(--r-16)" sizes="(min-width: 810px) 240px, 62vw" />
              <span className="t-cap muted">{item.caption}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <SectionHead title="Meet the team" action={<Link className="link" to="/book">Book someone</Link>} />
        <ul className="team-strip hscroll" aria-label="Our barbers, stylists and therapists">
          {data.staff
            .filter((s) => s.active)
            .map((member) => (
              <li key={member.id} className="team-card">
                <Avatar name={member.name} size={64} soft />
                <span className="t-title truncate">{member.name.split(" ")[0]}</span>
                <span className="muted t-cap truncate">{ROLE_LABEL[member.role]}</span>
                <span className="subtle t-cap truncate">{BRANCHES.find((b) => b.id === member.branchId)?.name}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="section">
        <SectionHead title="How booking works" />
        <ol className="steps hscroll">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step-card">
              <span className="step-num">{i + 1}</span>
              <p className="t-title">{step.title}</p>
              <p className="muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {reviews.length > 0 && (
        <section className="section">
          <SectionHead
            title="What clients say"
            action={
              <span className="inline gap-8 t-cap">
                <Stars value={rating} />
                {rating.toFixed(1)}
              </span>
            }
          />
          <div className="review-grid">
            {reviews.map((review) => (
              <figure key={review.id} className="card card-pad stack gap-8">
                <Stars value={review.rating} />
                <blockquote className="t-body">{review.text}</blockquote>
                <figcaption className="subtle t-cap">
                  {review.name} · {BRANCHES.find((b) => b.id === review.branchId)?.name}
                  {review.staffId && ` · with ${data.staff.find((s) => s.id === review.staffId)?.name.split(" ")[0] ?? ""}`}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="section home-closing">
        <div className="card card-pad stack gap-12 closing-card">
          <Wordmark on="dark" width={240} className="closing-logo" />
          <p className="t-h3">Ready when you are</p>
          <p className="muted">
            Book online, or message us on WhatsApp and we'll find you a slot. Walk-ins are always welcome.
            Booking just means you don't wait.
          </p>
          <div className="inline gap-8">
            <Cta tone="magenta" onClick={() => navigate("/book")}>
              Book a visit
            </Cta>
            <a
              className="btn btn-ghost-dark"
              href={whatsappLink(SALON.phone, `Hello ${SALON.name}, I'd like to book an appointment.`)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp us
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
