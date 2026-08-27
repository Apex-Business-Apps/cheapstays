import { Link } from "react-router-dom";
import { ArrowRight, Bed, Building2 } from "lucide-react";
import s3 from "@/assets/stay-3.jpg";
import s6 from "@/assets/stay-6.jpg";

const TILES = [
  {
    to: "/types-of-stays?type=condo",
    icon: Building2,
    title: "Condo Stays",
    body: "Comfortable condos for work, relaxation, and longer stays.",
    cta: "Explore Condo Stays",
    image: s3,
    alt: "Condo living room with a sofa and city view",
  },
  {
    to: "/types-of-stays?type=motel",
    icon: Bed,
    title: "Short Stays",
    body: "Motels and other short-term stays for quick getaways.",
    cta: "Explore Short Stays",
    image: s6,
    alt: "Bright motel bedroom with a made bed and warm lamp",
  },
];

/**
 * Two-tile browse-by-stay-type CTA row. Sits between the popular-cities
 * carousel and the affordable-stays carousel. Each tile routes to
 * `/types-of-stays?type=condo|motel` — the TypesOfStays page seeds the
 * initial tab from the same `?type=` param.
 */
export function BrowseByStayType() {
  return (
    <section className="container py-12 md:py-16">
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-6">
        Browse by stay type
      </h2>
      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        {TILES.map(({ to, icon: Icon, title, body, cta, image, alt }) => (
          <Link
            key={to}
            to={to}
            className="group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card"
          >
            <div className="grid grid-cols-[1fr_1fr]">
              <div className="relative p-6 md:p-7 flex flex-col justify-between min-h-[210px]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-card ring-1 ring-border/70 shadow-sm">
                  <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-xs">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary/80 group-hover:bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors">
                    {cta} <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
              <div className="relative overflow-hidden">
                <img
                  src={image}
                  alt={alt}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
