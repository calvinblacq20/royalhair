import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "../components/Chrome";
import { POLICIES, SALON } from "../data/business";
import { formatGhPhone, telLink, whatsappLink } from "../lib/contact";

/*
 * Plain-language privacy notice and booking terms, written for Ghana's Data Protection Act, 2012
 * (Act 843). Drafted for the salon to review: the owner confirms the business details, retention
 * period and policies (docs/GO-LIVE-INFO.md), and someone qualified checks the wording, before launch.
 */

export const LEGAL_UPDATED = "28 September 2026";

function Page({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="screen is-narrow">
      <TopBar back title={title} alwaysSolid backRow="Back" />
      <h1 className="t-h1 page-title">{title}</h1>
      <p className="t-lead">{lead}</p>
      <p className="subtle t-cap" style={{ marginTop: 8 }}>
        Last updated {LEGAL_UPDATED}
      </p>
      <div className="legal stack gap-24" style={{ marginTop: 24, marginBottom: 48 }}>
        {children}
      </div>
    </main>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack gap-8">
      <h2 className="t-h3">{title}</h2>
      {children}
    </section>
  );
}

function Contact() {
  return (
    <p>
      WhatsApp{" "}
      <a className="link" href={whatsappLink(SALON.phone, `Hi ${SALON.name}, I have a question about my details.`)} target="_blank" rel="noreferrer">
        {formatGhPhone(SALON.phone)}
      </a>
      {SALON.landline && (
        <>
          {" "}or call <a className="link" href={telLink(SALON.landline)}>{SALON.landline}</a>
        </>
      )}
      {SALON.email && (
        <>
          , or email{" "}
          <a className="link" href={`mailto:${SALON.email}`}>
            {SALON.email}
          </a>
        </>
      )}
      .
    </p>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy notice" lead={`What ${SALON.name} Salon & Spa keeps about you when you book, why, and what you can ask us to do with it.`}>
      <Part title="Who we are">
        <p>
          {SALON.name} Salon &amp; Spa runs this website and the booking system behind it, for our branches at West Hills Mall, Airport and Kumasi. We decide what
          happens to your details, so under Ghana's Data Protection Act, 2012 (Act 843) we are responsible for them. To reach us about your details:
        </p>
        <Contact />
      </Part>

      <Part title="What we keep, and why">
        <ul className="legal-list">
          <li>
            <b>Your name and WhatsApp number</b>, so we can confirm your booking, remind you, and find your history when you come back.
          </li>
          <li>
            <b>Your town or area</b>, so we can suggest the branch nearest to you.
          </li>
          <li>
            <b>Your email</b>, only if you choose to give it.
          </li>
          <li>
            <b>Your bookings and payments</b>: what you booked, when, with whom, what it cost and what you paid at the desk. We need these to run the salon and
            to keep proper business records.
          </li>
          <li>
            <b>Your hair record</b>: notes your stylist keeps (texture, colour formula, last relaxer, who you like to see), and any allergy or scalp
            sensitivity you tell us about. Allergies count as health information, so we only record them if you tell us, and only use them to keep you safe
            during treatments. Only our staff see your hair record.
          </li>
        </ul>
        <p>We don't take card or mobile money details on this website. You pay at the salon.</p>
      </Part>

      <Part title="On your phone">
        <p>
          If you tick "Remember me on this phone", your name and number are saved in this browser so the form is filled in next time. Bookings you make
          without an account are also remembered in this browser so you can find them again. We don't use cookies for tracking or advertising. You can clear
          these at any time from Profile, or by clearing your browser's site data.
        </p>
        <p>This website loads its fonts from Google, so Google sees that your browser visited the page.</p>
      </Part>

      <Part title="Who else sees it">
        <p>
          We never sell your details or share them for advertising. They are stored with the company that hosts our booking system, which may keep them on
          servers outside Ghana, under a contract that lets them use your details only to run the service for us. We may also share them where the law
          requires it.
        </p>
      </Part>

      <Part title="How long we keep it">
        <p>
          Payment records are kept for as long as Ghana's tax rules require. Your other details are kept while you're a client and deleted after a period of
          no visits that the salon sets, unless you ask us to delete them sooner.
        </p>
      </Part>

      <Part title="Your rights">
        <p>Under Act 843 you can ask us to:</p>
        <ul className="legal-list">
          <li>tell you what we hold about you and give you a copy;</li>
          <li>correct anything that's wrong;</li>
          <li>delete your details, apart from what we must keep by law;</li>
          <li>stop sending you reminders or messages about offers.</li>
        </ul>
        <p>
          Message us using the details above and we'll reply within 21 days. If you're not happy with how we handle your details, you can complain to the
          Data Protection Commission of Ghana.
        </p>
      </Part>

      <Part title="Children">
        <p>
          A parent or guardian books for children under 12. We keep the booking under the parent's name and number, and only what we need about the child to
          do their hair safely.
        </p>
      </Part>

      <p className="muted">
        See also our <Link to="/terms" className="link">booking terms</Link>.
      </p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Booking terms" lead={`How booking and paying at ${SALON.name} Salon & Spa works.`}>
      <Part title="Booking">
        <p>
          Booking online is free. Your booking is a request until the branch confirms your time and stylist on WhatsApp. If a time can't be kept, we'll offer
          you another.
        </p>
      </Part>

      <Part title="Prices">
        <p>
          Prices on this website are what we charge at the time you book. Prices shown as "from" depend on length, size or the products used, and are
          confirmed with you at the chair before we start. Anything added during your visit is agreed with you first.
        </p>
      </Part>

      <Part title="Paying">
        <p>
          Nothing is paid online. You pay at the salon when you're done, by cash, mobile money to the salon's number or card, and you get an official receipt
          for every payment. Receipts also appear under My visits.
        </p>
      </Part>

      <Part title="Changing or cancelling">
        <p>
          You can move or cancel your booking online any time before you arrive. Please give us at least {POLICIES.cancelWindowHours} hours' notice so
          someone else can have the time; inside that, please also call or WhatsApp the branch.
        </p>
      </Part>

      <Part title="Allergies and your safety">
        <p>
          Tell us about any allergy or scalp sensitivity before a relaxer, colour, dye or treatment. We note it on your hair record so whoever does your hair
          checks it first.
        </p>
      </Part>

      <Part title="Contact">
        <Contact />
      </Part>

      <p className="muted">
        How we look after your details is in our <Link to="/privacy" className="link">privacy notice</Link>. These terms are governed by the laws of Ghana.
      </p>
    </Page>
  );
}
