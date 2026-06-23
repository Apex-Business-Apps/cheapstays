import { useTranslation } from "react-i18next";

const stats = [
  { v: "₱18M+",  key: "s1Label" },
  { v: "12,400", key: "s2Label" },
  { v: "82",     key: "s3Label" },
  { v: "4.9★",   key: "s4Label" },
];

export function StatsStrip() {
  const { t } = useTranslation();

  return (
    <section className="snap-landing-strip border-y border-border/60 bg-secondary/40">
      <div className="container py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.key}>
            <p className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">{s.v}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">{t(`stats.${s.key}`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
