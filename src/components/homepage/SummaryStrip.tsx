import { BadgePercent, ShieldCheck, MapPin, Wallet } from "lucide-react";

const ITEMS = [
  {
    icon: BadgePercent,
    title: "Affordable rates",
    body: "Great stays without overspending.",
  },
  {
    icon: ShieldCheck,
    title: "Quality stays",
    body: "Carefully selected and quality checked.",
  },
  {
    icon: MapPin,
    title: "Metro Manila first",
    body: "Condos and short stays where you need to be.",
  },
  {
    icon: Wallet,
    title: "Better for lessors",
    body: "Lower fees. More of your earnings stay with you.",
  },
];

/**
 * Four-value summary strip. Sits directly below the hero and reads as a
 * quiet trust bar before the destination + listing sections.
 */
export function SummaryStrip() {
  return (
    <section className="container py-10 md:py-14">
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {ITEMS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/60 ring-1 ring-border/60">
              <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
