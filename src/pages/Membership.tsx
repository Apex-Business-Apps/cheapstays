import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

const tiers = [
  { name: "Libre", price: "₱0", blurb: "Hunt PH deals casually.", features: ["AI search (5/day)", "Public PH listings", "Weekly peso drop email"] },
  { name: "Member", price: "₱249/mo", highlight: true, blurb: "Every PH deal, the moment it lands.",
    features: ["Unlimited AI search","Real-time peso alerts","Owner-direct host contacts","Hidden island inventory","Priority Pip support"] },
];

export default function Membership() {
  return (
    <div className="container py-16">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Membership</h1>
        <p className="mt-3 text-muted-foreground">One tier. Everything unlocked. Cancel anytime.</p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 max-w-3xl">
        {tiers.map((t) => (
          <Card key={t.name} className={`p-6 ${t.highlight ? "border-accent ring-1 ring-accent" : ""}`}>
            <h3 className="text-xl font-medium">{t.name}</h3>
            <p className="text-3xl font-semibold mt-2">{t.price}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-success mt-0.5" /> {f}</li>
              ))}
            </ul>
            <Button className="w-full mt-6" variant={t.highlight ? "default" : "outline"}>
              {t.highlight ? "Go member" : "Stay free"}
            </Button>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Checkout wires to Stripe once enabled. Pesos billed monthly via GCash, Maya, or card.</p>
    </div>
  );
}
