import { CalendarCheck, Check, MessageCircle, Scissors, Sparkles } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Photo } from "../../components/Bits";
import { Reveal } from "../../components/Reveal";
import { motionMode } from "../../motion";

interface Step {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  body: string;
  check: string;
  photo: string;
  alt: string;
  position: string;
  float: { label: string; value: string; note: string };
}

const STEPS: Step[] = [
  {
    eyebrow: "Step 1 · Choose",
    icon: <Scissors size={14} />,
    title: "Pick your service and your branch.",
    body: "Every price and how long it takes is on the menu, for the barbershop, the salon, the nail bar and the spa.",
    check: "Prices shown before you book",
    photo: "/photos/salon-floor.webp",
    alt: "The Royal Hair salon floor",
    position: "center 30%",
    float: { label: "Knotless braids", value: "from GH₵ 450", note: "About 4 hours" },
  },
  {
    eyebrow: "Step 2 · Book",
    icon: <CalendarCheck size={14} />,
    title: "Choose your barber or stylist, and a time.",
    body: "Book the person you always sit with, or take whoever is free first. There's a slot every 15 minutes.",
    check: "Your chair is held for you",
    photo: "/photos/barbershop-pole.webp",
    alt: "The barber pole on the salon's red wall",
    position: "center 40%",
    float: { label: "Booked", value: "Sat, 10:30", note: "Men's haircut · Kwabena" },
  },
  {
    eyebrow: "Step 3 · Confirm",
    icon: <MessageCircle size={14} />,
    title: "We confirm it on WhatsApp.",
    body: "No deposit and no card details. The branch confirms your time on WhatsApp, and you can move or cancel your visit online.",
    check: "Nothing to pay until you're here",
    photo: "/photos/nail-bar.webp",
    alt: "Nail technicians at work at the nail bar",
    position: "center 45%",
    float: { label: "Confirmed", value: "Sat, 10:30", note: "On WhatsApp" },
  },
  {
    eyebrow: "Step 4 · Visit",
    icon: <Sparkles size={14} />,
    title: "Come in, sit down, walk out new.",
    body: "Pay at the salon when you're done: cash, MoMo or card, with an official receipt. When your usual cut or braids are due again, the front desk messages you on WhatsApp.",
    check: "Your stylist keeps your hair record",
    photo: "/photos/ombre-curls.webp",
    alt: "Long ombré curls on a client in the chair",
    position: "center 35%",
    float: { label: "Due back", value: "In 6 weeks", note: "Knotless braids" },
  },
];

/** Pinned feature cards that stack as you scroll, each sliding up over the last. */
export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how-head">
        <Reveal as="h2" look="focus" id="how-title" className="t-h2">
          How booking works
        </Reveal>
        <Reveal as="p" look="focus" delay={0.08} className="muted">
          From choosing your service to walking out of the chair.
        </Reveal>
      </div>
      <div className="stack-list">
        {STEPS.map((step, i) => (
          <StackCard key={step.title} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}

function StackCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLElement>(null);
  // Calm keeps the text brightening (opacity) and drops the photo zoom and the floating card's drift.
  const mode = motionMode();
  // Progress as this card rises from the bottom of the screen to its pinned position.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.2"] });
  const textOpacity = useTransform(scrollYProgress, [0.35, 1], [0.32, 1]);
  const floatY = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const floatRotate = useTransform(scrollYProgress, [0, 1], [index % 2 ? -6 : 6, 0]);
  const photoScale = useTransform(scrollYProgress, [0, 1], [1.12, 1]);

  // The CSS pins tall cards lower (see .stack-card), which needs the card's rendered height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => el.style.setProperty("--card-h", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={ref} className={`stack-card ${index % 2 ? "is-flipped" : ""}`} style={{ zIndex: index + 1 }}>
      <motion.div className="stack-text" style={mode === "off" ? undefined : { opacity: textOpacity }}>
        <span className="chip-soft">
          {step.icon}
          {step.eyebrow}
        </span>
        <h3 className="stack-title">{step.title}</h3>
        <p className="muted">{step.body}</p>
        <p className="stack-check">
          <Check size={15} /> {step.check}
        </p>
      </motion.div>
      <div className="stack-media">
        <motion.div className="stack-photo" style={mode === "full" ? { scale: photoScale } : undefined}>
          <Photo tone="mist" src={step.photo} alt={step.alt} position={step.position} sizes="(min-width: 1024px) 600px, 100vw" height="100%" radius={0} />
        </motion.div>
        <motion.div className="float-card" style={mode === "full" ? { y: floatY, rotate: floatRotate } : undefined}>
          <span className="subtle t-cap">{step.float.label}</span>
          <strong>{step.float.value}</strong>
          <span className="t-cap muted">{step.float.note}</span>
        </motion.div>
      </div>
    </article>
  );
}
