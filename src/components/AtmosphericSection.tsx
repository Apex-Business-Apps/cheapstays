import type { CSSProperties, ReactNode } from "react";
import { useMemo, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type AtmosphericSectionProps = {
  as?: "section" | "div";
  variant: "beach" | "city" | "neighborhood" | "interior";
  themeTone?: "light" | "dark" | "auto";
  parallaxStrength?: "none" | "subtle" | "standard";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

const PARALLAX_PIXELS = {
  none: 0,
  subtle: 20,
  standard: 36,
} as const;

export function AtmosphericSection({
  as = "section",
  variant,
  themeTone = "auto",
  parallaxStrength = "subtle",
  className,
  contentClassName,
  children,
}: AtmosphericSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -PARALLAX_PIXELS[parallaxStrength]]);
  const style = useMemo(() => ({ "--atmo-parallax-y": "0px" } as CSSProperties), []);

  const commonProps = {
    className: cn("atmo-section relative isolate overflow-hidden", className),
    "data-atmo-variant": variant,
    "data-atmo-tone": themeTone,
    style,
  };

  const layers = (
    <>
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 atmo-bg-layer" style={prefersReducedMotion ? undefined : { y }} />
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
