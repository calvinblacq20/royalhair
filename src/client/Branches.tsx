import { useNavigate } from "react-router-dom";
import { Cta } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { MapCard } from "../components/MapCard";
import { Reveal } from "../components/Reveal";
import { SALON } from "../data/business";
import { useAppData } from "../data/store";
import { whatsappLink } from "../lib/contact";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Addresses, real opening hours and the right phone number per branch — none of which exists online today. */
export function Branches() {
  const data = useAppData();
  const navigate = useNavigate();
  const now = new Date();

  return (
    <main className="screen">
      <TopBar back title="Branches" alwaysSolid backRow="Back" />
      <Reveal as="h1" className="t-h1 page-title">
        Where to find us
      </Reveal>
      <Reveal as="p" className="t-lead" delay={0.05}>
        Three branches, each with its own number. Ring the branch you're coming to and you won't be
        passed around.
      </Reveal>

      <div className="branch-list">
        {data.branches
          .filter((b) => b.active)
          .map((branch) => (
            <section key={branch.id} className="section">
              <MapCard branch={branch} now={now} />
              <div className="card card-pad stack gap-8">
                <p className="t-title">Opening hours</p>
                <ul className="stack gap-4">
                  {WEEKDAYS.map((label, index) => {
                    const hours = branch.hours[index];
                    const isToday = index === now.getDay();
                    return (
                      <li key={label} className={`kv ${isToday ? "hours-today" : ""}`}>
                        <span className={isToday ? "" : "muted"}>{label}</span>
                        <span className={hours ? "" : "subtle"}>{hours ? `${hours[0]} – ${hours[1]}` : "Closed"}</span>
                      </li>
                    );
                  })}
                </ul>
                {branch.landmark && <p className="muted t-cap">{branch.landmark}</p>}
                <p className="subtle t-cap">
                  {branch.chairs} chairs
                  {branch.plusCode ? ` · Plus Code ${branch.plusCode}` : ""}
                  {branch.digitalAddress ? ` · GhanaPost ${branch.digitalAddress}` : ""}
                </p>
              </div>
            </section>
          ))}
      </div>

      <section className="section stack gap-8">
        <p className="muted">
          Not sure which branch suits you? Message us and we'll point you to the nearest one with a free chair.
        </p>
        <div className="inline gap-8">
          <Cta onClick={() => navigate("/book")}>Book a visit</Cta>
          <a
            className="btn btn-outline"
            href={whatsappLink(SALON.phone, `Hello ${SALON.name}, which branch is closest to me?`)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp us
          </a>
        </div>
      </section>
    </main>
  );
}

