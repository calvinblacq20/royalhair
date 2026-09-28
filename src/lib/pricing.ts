import type { Service } from "../data/types";
import { money } from "./format";

/** What a basket of services costs. */
export function cartTotal(services: Service[]): number {
  return services.reduce((sum, s) => sum + s.price, 0);
}

/** "GH₵ 60", or "from GH₵ 450" when length or size changes the price. */
export function priceLabel(service: Pick<Service, "price" | "priceFrom">): string {
  return service.priceFrom ? `from ${money(service.price)}` : money(service.price);
}


/** "2 hr 30 min", "45 min" */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} hr`;
  return rest ? `${hourPart} ${rest} min` : hourPart;
}

/** The commission a staff member earns on a visit total. */
export function commissionFor(total: number, rate: number): number {
  return Math.round(total * rate * 100) / 100;
}
