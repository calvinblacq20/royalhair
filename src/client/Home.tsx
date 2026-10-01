import { Baby, CalendarCheck, Clock, Gift, Heart, MapPin, MessageCircle, Pause, Phone, Play, Scissors, Share2, Sparkles, Users, Wallet } from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppIcon } from "../components/Brand";
import { Photo, SectionHead, Skeleton, Stars, useSkeleton } from "../components/Bits";
import { Button, Cta } from "../components/Button";
import { MapCard } from "../components/MapCard";
import { Marquee } from "../components/Marquee";
import { Reveal } from "../components/Reveal";
import { CountUp, ScrollRevealText, useScrollTo } from "../components/Scroll";
import { ClosingCta } from "./home/ClosingCta";
import { nextSlide, preloadPhoto, useAutoplay } from "./home/autoplay";
import { useHeroCurve } from "./home/heroCurve";
import { HowItWorks } from "./home/HowItWorks";
import { WhyBento } from "./home/WhyBento";
import { useNotify } from "../components/Notify";
import { Sheet } from "../components/Sheet";
import { BRANCHES, LOOKBOOK, SALON, SALON_FEATURES, SALON_PHOTOS } from "../data/business";
import { GROUPS, SERVICES, serviceById } from "../data/catalog";
import { accountOf, useAppData } from "../data/store";
import type { ServiceGroup, Tone } from "../data/types";
import { formatGhPhone, telLink, whatsappLink } from "../lib/contact";
import { fmtDate, money, weekdayLong } from "../lib/format";
import { durationLabel, priceLabel } from "../lib/pricing";
import { openStatus } from "../lib/schedule";
import { enter, isCalm, motionMode, spring } from "../motion";

const SECTIONS = [
  { id: "lookbook", label: "Lookbook" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "reviews", label: "Reviews" },
  { id: "info", label: "Info" },
] as const;

const FEATURE_ICONS = { scissors: Scissors, users: Users, map: MapPin, wallet: Wallet, calendar: CalendarCheck, sparkles: Sparkles } as const;
const HERO = SALON_PHOTOS;
const heroShot = (n: number) => HERO[n % HERO.length] ?? HERO[0];
/** Rendered widths of the gallery's big photo and its two side photos. */
const GALLERY_SIZES = ["(min-width: 1024px) 800px, 66vw", "(min-width: 1024px) 400px, 33vw", "(min-width: 1024px) 400px, 33vw"] as const;
const GALLERY_FADE_S = 0.9;
const STATEMENT =
  "Royal Hair is a barbershop, salon, nail bar and spa under one roof, in Accra and Kumasi. Cuts and fades, braids and silk presses, nails and massage, for everyone in the family.";
const HIGHLIGHTS = [
  { icon: Scissors, title: "Barbershop and salon", note: "Barbers and stylists under one roof" },
  { icon: MapPin, title: "Three branches", note: "West Hills Mall, Airport and Kumasi" },
  { icon: Baby, title: "Kids welcome", note: "Cuts and braids for under-12s" },
];
const LOOK_TONES: Tone[] = ["sage", "blush", "ink", "champagne", "plum"];

export function Home() {
  const loading = useSkeleton(700);
  return loading ? <HomeSkeleton /> : <SalonPage />;
}

function HomeSkeleton() {
  return (
    <main className="screen" aria-busy="true" aria-label="Loading salon">
      <Skeleton w="calc(100% + var(--gutter) * 2)" h={440} r={0} className="mobile-only" style={{ marginInline: "calc(var(--gutter) * -1)" }} />
      <Skeleton h={520} r={12} className="desktop-only" style={{ marginTop: 4 }} />
      <div className="stack gap-12 intro">
        <div className="stack gap-12" style={{ maxWidth: 760 }}>
          <Skeleton w="62%" h={30} />
          <Skeleton w="30%" h={14} />
          <Skeleton w="48%" h={14} />
          <Skeleton h={40} r={7} />
          <Skeleton w="24%" h={20} style={{ marginTop: 16 }} />
          <Skeleton h={14} />
          <Skeleton w="80%" h={14} />
          <div className="stack gap-12" style={{ marginTop: 16 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={96} r={8} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function SalonPage() {
  const data = useAppData();
  const account = accountOf(data);
  const navigate = useNavigate();
  const notify = useNotify();
  const now = new Date();
  const branches = data.branches.filter((b) => b.active);
  const [branchId, setBranchId] = useState(() => data.device.branchId ?? branches[0]?.id ?? BRANCHES[0]!.id);
  const branch = branches.find((b) => b.id === branchId) ?? branches[0] ?? BRANCHES[0]!;
  const status = openStatus(now, branch.hours);
  const [slide, setSlide] = useState(0);
  const [saved, setSaved] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [group, setGroup] = useState<ServiceGroup | "featured">("featured");
  const [active, setActive] = useState<string>("lookbook");
  const [showHeader, setShowHeader] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [lookbookPaused, setLookbookPaused] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const menu = SERVICES.filter((s) => s.active !== false);
  const services = useMemo(() => (group === "featured" ? menu.filter((s) => s.featured) : menu.filter((s) => s.group === group)), [group, menu]);
  const cheapest = Math.min(...menu.map((s) => s.price));
  const published = data.reviews.filter((r) => r.status === "published");

  useEffect(() => {
    const onScroll = () => setShowHeader(window.scrollY > (heroRef.current?.offsetHeight ?? 300) - 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-130px 0px -55% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const share = async () => {
    const shareData = { title: SALON.name, text: `${SALON.name}: ${SALON.tagline} in Accra and Kumasi`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        notify("Link copied", "Paste it anywhere to share the salon.");
      }
    } catch {
      /* the person closed the share sheet */
    }
  };

  const scrollTo = useScrollTo();
  const goTo = (id: string) => scrollTo(document.getElementById(id), { offset: window.innerWidth >= 810 ? -140 : -112 });
  // Calm mode (reduced motion, incl. iOS Low Power Mode) leaves out the parallax and zoom below.
  const calm = isCalm();
  // Hero photos drift and settle as the page starts to scroll.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 90]);
  const heroScale = useTransform(scrollY, [0, 600], [1, 1.08]);
  // ...and their bottom edge starts as a U that straightens out. The phone intro sheet overlaps the photo by 24px.
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryCurve = useHeroCurve(galleryRef);
  const heroCurve = useHeroCurve(heroRef, { overlap: 24 });
  // The photos also move on by themselves: the gallery crossfades to the next set, the phone carousel slides.
  const trackRef = useRef<HTMLDivElement>(null);
  // `prev` is the set being covered while the next one fades in over it.
  const [gallery, setGallery] = useState<{ step: number; prev: number | null }>({ step: 0, prev: null });
  useAutoplay(galleryRef, async () => {
    const next = gallery.step + 1;
    await Promise.all(GALLERY_SIZES.map((sizes, i) => preloadPhoto(heroShot(next + i).src, sizes)));
    setGallery({ step: next, prev: gallery.step });
  });
  useAutoplay(heroRef, async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = nextSlide(track.scrollLeft, track.clientWidth, HERO.length);
    await preloadPhoto(heroShot(next).src, "100vw");
    track.scrollTo({ left: next * track.clientWidth, behavior: motionMode() === "full" ? "smooth" : "auto" });
  });

  const actionButtons = (
    <>
      <button className="icon-btn" onClick={share} aria-label="Share the salon">
        <Share2 size={18} strokeWidth={1.8} />
      </button>
      <motion.button className={`icon-btn ${saved ? "is-on" : ""}`} onClick={() => setSaved(!saved)} aria-pressed={saved} aria-label="Save the salon" whileTap={{ scale: 0.85 }} transition={spring.press}>
        <Heart size={18} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
      </motion.button>
    </>
  );

  return (
    <main className="screen studio">
      {/* Phone: sticky header that appears once the hero scrolls away */}
      <div className="overlay-header mobile-only">
        <AnimatePresence>
          {showHeader && (
            <motion.div className="overlay-header-inner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.micro}>
              <div className="between" style={{ padding: "10px 16px 4px" }}>
                <div className="inline" style={{ gap: 10 }}>
                  <AppIcon size={30} />
                  <span className="t-title">{SALON.name}</span>
                </div>
                <div className="inline" style={{ gap: 8 }}>
                  {actionButtons}
                </div>
              </div>
              <nav className="section-tabs" aria-label="Salon sections">
                {SECTIONS.map((s) => (
                  <button key={s.id} className={`section-tab ${active === s.id ? "is-active" : ""}`} onClick={() => goTo(s.id)}>
                    {s.label}
                    {active === s.id && <motion.span layoutId="section-underline" className="section-underline" transition={spring.press} />}
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Wider screens: photo gallery grid */}
      <motion.div ref={galleryRef} className="desk-gallery desktop-only" style={{ clipPath: galleryCurve.clipPath, WebkitClipPath: galleryCurve.WebkitClipPath }}>
        {GALLERY_SIZES.map((sizes, i) => (
          <div key={i} className="gallery-cell">
            <motion.div className="gallery-inner" initial={calm ? { opacity: 0 } : { scale: 1.18, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.settle, delay: 0.08 * i }} style={calm ? undefined : { y: heroY }}>
              {/* The incoming photo fades in on top; the old one stays underneath until the last cell has finished. */}
              {(gallery.prev === null ? [gallery.step] : [gallery.prev, gallery.step]).map((step) => {
                const shot = heroShot(step + i);
                const incoming = gallery.prev !== null && step === gallery.step;
                return (
                  <motion.div
                    key={shot.src}
                    className="gallery-layer"
                    aria-hidden={step !== gallery.step || undefined}
                    initial={gallery.prev === null ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: GALLERY_FADE_S, delay: 0.12 * i, ease: [0.44, 0, 0.56, 1] }}
                    onAnimationComplete={incoming && i === GALLERY_SIZES.length - 1 ? () => setGallery((g) => ({ ...g, prev: null })) : undefined}
                  >
                    <Photo tone="mist" src={shot.src} alt={shot.alt} position={shot.position} eager={i === 0} sizes={sizes} height="100%" radius={0} markSize={i === 0 ? 150 : 70} />
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        ))}
        <motion.span className="desk-gallery-count" style={{ y: galleryCurve.badgeY }}>
          {HERO.length} photos
        </motion.span>
      </motion.div>

      {/* Phone: hero carousel */}
      <motion.div ref={heroRef} className="hero mobile-only" style={{ clipPath: heroCurve.clipPath, WebkitClipPath: heroCurve.WebkitClipPath }}>
        <motion.div
          ref={trackRef}
          className="hero-track"
          style={calm ? undefined : { y: heroY, scale: heroScale }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {HERO.map((shot, i) => (
            <Photo key={shot.src} tone="mist" src={shot.src} alt={shot.alt} position={shot.position} eager={i === 0} sizes="100vw" height={440} radius={0} markSize={120} className="hero-slide" />
          ))}
        </motion.div>
        <div className="hero-actions">{actionButtons}</div>
        <motion.span className="hero-count t-cap" style={{ y: heroCurve.badgeY }}>
          {slide + 1}/{HERO.length}
        </motion.span>
      </motion.div>

      {/* Intro sheet */}
      <motion.section className="intro" {...enter(24)}>
        <div className="between" style={{ alignItems: "flex-start" }}>
          <div className="stack gap-4">
            <h1 className="t-h2">{SALON.name}</h1>
            <p className="muted">{SALON.category}</p>
          </div>
          <div className="inline" style={{ gap: 8 }}>
            <span className="pill-tag" title="Figures in this preview are samples">
              Demo
            </span>
            <span className="inline desktop-only" style={{ gap: 8 }}>
              {actionButtons}
            </span>
          </div>
        </div>
        <button className="inline t-body" onClick={() => goTo("reviews")} style={{ gap: 6 }}>
          <Stars value={SALON.rating} />
          <strong style={{ fontWeight: 500 }}>{SALON.rating}</strong>
          <span className="subtle">({SALON.reviewCount})</span>
        </button>
        <p className="inline" style={{ color: status.open ? "var(--open)" : "var(--warning-ink)" }}>
          <Clock size={15} />
          <span>
            {branch.name}: {status.label}
          </span>
        </p>
        <button className="address-chip" onClick={() => goTo("info")}>
          <MapPin size={16} />
          <span className="truncate">{SALON.area}</span>
        </button>
      </motion.section>

      <div className="studio-layout">
        <div className="studio-main">
          <nav className="section-tabs desk-section-tabs desktop-only" aria-label="Salon sections">
            {SECTIONS.map((s) => (
              <button key={s.id} className={`section-tab ${active === s.id ? "is-active" : ""}`} onClick={() => goTo(s.id)}>
                {s.label}
                {active === s.id && <motion.span layoutId="desk-section-underline" className="section-underline" transition={spring.press} />}
              </button>
            ))}
          </nav>

          {/* Lookbook: their own work, one photo per kind of service */}
          <section id="lookbook" className="section anchor">
            <SectionHead
              title="Lookbook"
              action={
                <span className="inline" style={{ gap: 4 }}>
                  <button className="icon-btn is-plain lookbook-toggle" onClick={() => setLookbookPaused(!lookbookPaused)} aria-pressed={lookbookPaused} aria-label={lookbookPaused ? "Play the lookbook" : "Pause the lookbook"}>
                    {lookbookPaused ? <Play size={15} strokeWidth={1.8} /> : <Pause size={15} strokeWidth={1.8} />}
                  </button>
                  <Link className="link t-cap" to="/services">
                    See all
                  </Link>
                </span>
              }
            />
            {/* Photos drift left to right on their own; drag to look around, or pause. */}
            <Marquee label="Lookbook" className="looks" direction="right" paused={lookbookPaused}>
              {LOOKBOOK.map((look, i) => (
                <Link key={look.id} to={`/services?group=${look.group}`} className="look-card" aria-label={`${look.label} at ${SALON.name}`} draggable={false}>
                  <Photo tone={LOOK_TONES[i % LOOK_TONES.length] ?? "blush"} src={look.src} alt={`${look.label} at ${SALON.name}`} sizes="(min-width: 810px) 240px, 150px" ratio="3 / 4" radius="var(--r-img)" markSize={56}>
                    <span className="look-label">{look.label}</span>
                  </Photo>
                </Link>
              ))}
            </Marquee>
          </section>

          {/* About */}
          <section id="about" className="section anchor about">
            <Reveal as="span" look="focus" className="chip-soft">
              <Scissors size={13} /> About the salon
            </Reveal>
            <ScrollRevealText className="statement" text={STATEMENT} />
            <div className="highlights">
              {HIGHLIGHTS.map((h, i) => (
                <Reveal key={h.title} className="highlight" y={20} delay={0.1 * i}>
                  <span className="highlight-icon">
                    <h.icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="stack">
                    <span className="t-title" style={{ fontSize: 15 }}>
                      {h.title}
                    </span>
                    <span className="subtle t-cap">{h.note}</span>
                  </span>
                </Reveal>
              ))}
            </div>
            {aboutOpen && (
              <motion.p className="t-lead" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.small} style={{ color: "var(--ink-75)" }}>
                {SALON.about}
              </motion.p>
            )}
            <button className="link t-body" onClick={() => setAboutOpen(!aboutOpen)} style={{ alignSelf: "flex-start" }}>
              {aboutOpen ? "Show less" : "More about the salon"}
            </button>
          </section>

          {/* Services */}
          <section id="services" className="section anchor">
            <SectionHead title="Services" />
            <div className="chips">
              {[{ id: "featured" as const, label: "Featured" }, ...GROUPS].map((g) => (
                <button key={g.id} className={`chip ${group === g.id ? "is-active" : ""}`} onClick={() => setGroup(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
            <motion.div layout className="card styles-list" style={{ borderRadius: "var(--r-16)" }} transition={spring.small}>
              <AnimatePresence mode="popLayout" initial={false}>
                {services.slice(0, 4).map((service, i) => (
                  <motion.div key={service.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...spring.small, delay: i * 0.04 }}>
                    <div className="style-row">
                      <Photo tone={service.tone} src={service.photo} alt={service.name} sizes="76px" height={76} radius="var(--r-img)" markSize={26} className="style-thumb" />
                      <div className="grow stack gap-4">
                        <p className="t-title">{service.name}</p>
                        <p className="subtle t-cap">About {durationLabel(service.minutes)}</p>
                        <p className="tabular" style={{ fontWeight: 500 }}>
                          {priceLabel(service)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/book?service=${service.id}`)} aria-label={`Book ${service.name}`}>
                        Book
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            <Link to="/services" className="btn btn-outline btn-block">
              See all {menu.length} services
            </Link>
          </section>
        </div>

        {/* Desktop: sticky side card, like a venue page on the web */}
        <aside className="studio-aside desk" aria-label="Book at the salon">
          <div className="card aside-card stack gap-12">
            <div className="inline" style={{ gap: 12 }}>
              <AppIcon size={48} />
              <div className="stack">
                <p className="t-title">{SALON.name}</p>
                <span className="inline t-cap" style={{ gap: 6 }}>
                  <strong style={{ fontWeight: 500 }}>{SALON.rating}</strong>
                  <Stars value={SALON.rating} size={12} />
                  <span className="subtle">({SALON.reviewCount})</span>
                </span>
              </div>
            </div>
            <p className="inline t-body" style={{ color: status.open ? "var(--open)" : "var(--warning-ink)" }}>
              <Clock size={15} /> {branch.name}: {status.label}
            </p>
            <div className="divider" style={{ margin: 0 }} />
            <p className="info-line">
              <MapPin size={16} />
              <span>{SALON.area}</span>
            </p>
            <p className="info-line">
              <Baby size={16} />
              <span>Kids welcome</span>
            </p>
            <p className="info-line">
              <Scissors size={16} />
              <span>
                {menu.length} services from {money(cheapest)}
              </span>
            </p>
            <Cta className="btn-block" onClick={() => navigate("/book")}>
              Book now
            </Cta>
            <a className="btn btn-outline btn-block" href={SALON.whatsappBusiness} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Chat on WhatsApp
            </a>
          </div>
          <div className="card card-pad stack gap-8">
            <Photo tone="mist" src="/photos/barber-kid-cut.webp" alt="A barber giving a young client a haircut" position="center 30%" sizes="320px" height={150} radius="var(--r-img)" />
            <p className="t-title">Bring the kids</p>
            <p className="muted">Book a kids' cut, braids or a wash and style alongside your own visit, with the same barber or stylist if you like.</p>
            <Link className="link t-body" to="/book?service=s-kidscut" style={{ alignSelf: "flex-start" }}>
              Book for a child
            </Link>
          </div>
        </aside>
      </div>

      <HowItWorks />

      <WhyBento />

      {/* Reviews */}
      <section id="reviews" className="section anchor">
        <SectionHead
          title="Reviews"
          action={
            <button className="link t-cap" onClick={() => setReviewsOpen(true)}>
              See all
            </button>
          }
        />
        <div className="card card-pad stack gap-8">
          <div className="inline" style={{ gap: 12 }}>
            <CountUp className="t-num" to={SALON.rating} decimals={1} />
            <div className="stack">
              <Stars value={SALON.rating} size={16} />
              <span className="subtle t-cap">
                <CountUp to={SALON.reviewCount} /> reviews
              </span>
            </div>
          </div>
          <p className="muted">Clients mention clean fades, braids that don't hurt, pedicures worth coming back for, and being seated quickly.</p>
          <p className="inline subtle t-cap">
            <Sparkles size={13} /> Summary of client reviews
          </p>
        </div>
        <div className="stack gap-12 review-list">
          {published.slice(0, 2).map((r) => (
            <ReviewItem key={r.id} name={r.name} rating={r.rating} text={r.text} at={r.at} serviceId={r.serviceId} staffName={data.staff.find((s) => s.id === r.staffId)?.name} />
          ))}
        </div>
      </section>

      {/* Info */}
      <div className="desk-3col">
        <section id="info" className="section anchor">
          <SectionHead title="Opening times" />
          <div className="chips" role="group" aria-label="Branch">
            {branches.map((b) => (
              <button key={b.id} className={`chip ${b.id === branch.id ? "is-active" : ""}`} onClick={() => setBranchId(b.id)} aria-pressed={b.id === branch.id}>
                {b.name}
              </button>
            ))}
          </div>
          <div className="card card-pad stack gap-8">
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
              const span = branch.hours[dow];
              const today = dow === now.getDay();
              const sample = new Date(2026, 0, 4 + dow);
              return (
                <div key={dow} className="between" style={{ fontWeight: today ? 500 : 400 }}>
                  <span>{weekdayLong(sample)}</span>
                  <span className="tabular" style={{ color: span ? undefined : "var(--ink-62)" }}>
                    {span ? `${span[0]} – ${span[1]}` : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section">
          <SectionHead title="Good to know" />
          <div className="card list-card">
            {SALON_FEATURES.map((f) => {
              const Icon = FEATURE_ICONS[f.icon];
              return (
                <div key={f.label} className="row">
                  <span className="row-icon">
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <span>{f.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section">
          <SectionHead title="Getting there" />
          <MapCard branch={branch} now={now} />
        </section>
      </div>

      <div className="desk-2col">
        <section className="section">
          <SectionHead title="Contact" />
          <div className="card list-card">
            <a className="row" href={SALON.whatsappBusiness} target="_blank" rel="noreferrer">
              <span className="row-icon is-pink">
                <MessageCircle size={18} strokeWidth={1.7} />
              </span>
              <span className="grow">Chat on WhatsApp</span>
            </a>
            <a className="row" href={telLink(branch.phone)}>
              <span className="row-icon">
                <Phone size={18} strokeWidth={1.7} />
              </span>
              <span className="grow">
                Call {branch.name} · {formatGhPhone(branch.phone)}
              </span>
            </a>
          </div>
        </section>

        <section className="section">
          <SectionHead title="Loyalty" />
          <div className="card list-card">
            {account ? (
              <div className="row">
                <span className="row-icon is-pink">
                  <Sparkles size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>{account.points} points</span>
                  <span className="subtle t-cap">Worth {money(account.points / 10)} off your next visit</span>
                </span>
              </div>
            ) : (
              <Link className="row" to="/profile">
                <span className="row-icon is-pink">
                  <Sparkles size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>Earn points on every visit</span>
                  <span className="subtle t-cap">Optional: save an account with your WhatsApp number to collect them</span>
                </span>
              </Link>
            )}
            <a className="row" href={whatsappLink("", `I get my hair done at ${SALON.name}. Book here: ${window.location.origin}`)} target="_blank" rel="noreferrer">
              <span className="row-icon">
                <Gift size={18} strokeWidth={1.7} />
              </span>
              <span className="grow stack">
                <span>Refer a friend</span>
                <span className="subtle t-cap">You both get 100 points on their first visit</span>
              </span>
            </a>
          </div>
        </section>
      </div>

      <ClosingCta />

      <div className="floating-bar lt-desk">
        <div className="sticky-bar-meta">
          <strong>{menu.length} services</strong>
          <span className="subtle t-cap">from {money(cheapest)}</span>
        </div>
        <Cta onClick={() => navigate("/book")}>Book now</Cta>
      </div>

      <Sheet open={reviewsOpen} onClose={() => setReviewsOpen(false)} title={`${SALON.reviewCount} reviews`}>
        <div className="stack gap-12">
          {published.map((r) => (
            <ReviewItem key={r.id} name={r.name} rating={r.rating} text={r.text} at={r.at} serviceId={r.serviceId} staffName={data.staff.find((s) => s.id === r.staffId)?.name} flat />
          ))}
          <p className="t-cap subtle" style={{ textAlign: "center" }}>
            Sample reviews for this preview.
          </p>
        </div>
      </Sheet>
    </main>
  );
}

function ReviewItem({ name, rating, text, at, serviceId, staffName, flat }: { name: string; rating: number; text: string; at: string; serviceId?: string; staffName?: string; flat?: boolean }) {
  const service = serviceId ? serviceById(serviceId) : undefined;
  const body = (
    <>
      <div className="inline" style={{ gap: 10 }}>
        <span className="avatar is-soft" style={{ width: 36, height: 36, fontSize: 13 }} aria-hidden="true">
          {name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
        <div className="stack">
          <span style={{ fontWeight: 500 }}>{name}</span>
          <Stars value={rating} size={12} />
        </div>
      </div>
      <p>{text}</p>
      <p className="subtle t-cap">{[fmtDate(new Date(at)), service?.name, staffName && `with ${staffName.split(" ")[0]}`].filter(Boolean).join(" · ")}</p>
      {flat && <div className="divider" style={{ margin: 0 }} />}
    </>
  );
  return flat ? (
    <article className="stack gap-8">{body}</article>
  ) : (
    <Reveal as="article" className="card card-pad stack gap-8" y={16}>
      {body}
    </Reveal>
  );
}
