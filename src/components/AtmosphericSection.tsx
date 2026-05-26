import type { CSSProperties, ReactNode } from "react";
import { useMemo, useRef, useState, useEffect } from "react";
import { motion, useReducedMotion, useScroll, useTransform, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

type AtmosphericSectionProps = {
  as?: "section" | "div";
  variant: "beach" | "city" | "neighborhood" | "interior" | "lake" | "coastal";
  parallaxStrength?: "none" | "subtle" | "standard";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

const WALLPAPERS = {
  beach: "/wallpapers/01-wallpaper-beach-sunset-premium.png",
  city: "/wallpapers/02-wallpaper-city-dusk-premium.png",
  neighborhood: "/wallpapers/03-wallpaper-neighborhood-premium.png",
  interior: "/wallpapers/04-wallpaper-interior-tropical-premium.png",
  lake: "/wallpapers/05-wallpaper-mountain-lake-premium.png",
  coastal: "/wallpapers/06-wallpaper-coastal-cove-premium.png",
} as const;

export function AtmosphericSection({
  as = "section",
  variant,
  parallaxStrength = "subtle",
  className,
  contentClassName,
  children,
}: AtmosphericSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Track window width for responsive parallax ranges
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });

  const range = useMemo(() => {
    if (parallaxStrength === "none" || prefersReducedMotion) return 0;
    // Desktop: 36px, Tablet: 24px, Mobile: 12px
    const baseRange = windowWidth <= 768 ? 12 : windowWidth <= 1200 ? 24 : 36;
    return parallaxStrength === "subtle" ? baseRange / 2 : baseRange;
  }, [parallaxStrength, windowWidth, prefersReducedMotion]);

  // Spring-smoothed translation with inertia to prevent rigid scroll feeling
  const rawY = useTransform(scrollYProgress, [0, 1], [range, -range]);
  const smoothY = useSpring(rawY, { stiffness: 70, damping: 26, mass: 0.4 });
  const y = useTransform(smoothY, (val: number) => `${val}px`);

  const style = useMemo(() => ({
    "--atmo-wallpaper-url": `url(${WALLPAPERS[variant]})`,
    "--atmo-wallpaper-position": "center",
    "--atmo-wallpaper-scale": "1.08",
  } as CSSProperties), [variant]);

  const commonProps = {
    className: cn("atmo-section relative isolate overflow-hidden", className),
    "data-atmo-variant": variant,
    style,
  };

  const layers = (
    <>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 atmo-bg-layer"
        style={{
          "--atmo-parallax-y": y,
        } as CSSProperties}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 atmo-tint-layer" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 atmo-veil-layer" />
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </>
  );

  if (as === "div") {
    return <div ref={sectionRef as React.RefObject<HTMLDivElement>} {...commonProps}>{layers}</div>;
  }

  return <section ref={sectionRef as React.RefObject<HTMLElement>} {...commonProps}>{layers}</section>;
}

