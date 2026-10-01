import { Navigation, Phone } from "lucide-react";
import { useState } from "react";
import type { Branch } from "../data/types";
import { openingOn } from "../lib/booking";
import { formatGhPhone, mapsLinks, telLink } from "../lib/contact";
import { fmtTime } from "../lib/format";
import { AppIcon } from "./Brand";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** Stylised map (no third-party tiles, so it stays light on slow connections). */
export function MapCard({ branch, now = new Date() }: { branch: Branch; now?: Date }) {
  const [open, setOpen] = useState(false);
  const links = mapsLinks(`${branch.name} ${branch.address}`);
  const opening = openingOn(branch, now);
  const openNow = opening !== null && now >= opening.start && now < opening.end;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="map" aria-hidden="true">
        <svg viewBox="0 0 400 168" preserveAspectRatio="xMidYMid slice">
          <rect width="400" height="168" fill="#e4e9f1" />
          <path d="M-10 120 C 80 100, 140 140, 230 110 S 360 70, 420 90" stroke="#fff" strokeWidth="14" fill="none" />
          <path d="M150 -10 C 170 60, 160 110, 190 180" stroke="#fff" strokeWidth="9" fill="none" />
          <path d="M-10 40 L 420 58" stroke="#fff" strokeWidth="6" fill="none" />
          <path d="M290 -10 L 270 180" stroke="#fff" strokeWidth="5" fill="none" />
          <rect x="30" y="62" width="70" height="34" rx="6" fill="#e2e2e5" />
          <rect x="220" y="10" width="44" height="30" rx="6" fill="#e2e2e5" />
          <rect x="305" y="108" width="80" height="44" rx="6" fill="#dbe5d6" />
          <text x="18" y="114" fontSize="9" fill="#9b8c85" fontFamily="Inter, sans-serif">
            {branch.area}
          </text>
        </svg>
        <div className="map-pin">
          <AppIcon size={40} />
          <span className="map-pin-stem" />
        </div>
      </div>
      <div className="card-pad stack gap-8">
        <p className="t-title">{branch.name}</p>
        <p className="muted">{branch.address}</p>
        <p className={`t-cap ${openNow ? "is-open" : "subtle"}`}>
          {opening ? (openNow ? `Open now · closes ${fmtTime(opening.end)}` : `Closed · opens ${fmtTime(opening.start)}`) : "Closed today"}
        </p>
        <div className="inline gap-8">
          <Button size="sm" icon={<Navigation size={16} />} onClick={() => setOpen(true)}>
            Directions
          </Button>
          <a className="btn btn-outline btn-sm" href={telLink(branch.phone)}>
            <Phone size={16} strokeWidth={1.8} />
            {formatGhPhone(branch.phone)}
          </a>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Directions to ${branch.name}`}>
        <div className="stack gap-12">
          <a className="btn btn-outline btn-block" href={links.google} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Open in Google Maps
          </a>
          <a className="btn btn-outline btn-block" href={links.apple} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Open in Apple Maps
          </a>
        </div>
      </Sheet>
    </div>
  );
}
