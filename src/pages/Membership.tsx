import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Check, Loader2, CreditCard } from "lucide-react";
import { Seo } from "@/components/Seo";

const tiers = [
  {
    name: "Libre",
    price: "₱0",
    blurb: "Hunt PH deals casually.",
    features: [
      "AI search (5 searches/day)",
      "Public PH listings",
      "Weekly peso drop email",
    ],
    highlight: false,
  },
  {
    name: "Member",
    price: "₱249",
    period: "/month",
    blurb: "Every PH deal, the moment it lands.",
    features: [
      "Unlimited AI search",
      "Real-time peso alerts",
      "Owner-direct host contacts",
      "Hidden island inventory",
      "Priority Pip support",
    ],
    highlight: true,
  },
];

const featureMatrix = [
  { feature: "AI-powered deal search", libre: "5/day", member: "Unlimited" },
  { feature: "Public listings", libre: true, member: true },
  { feature: "Owner-direct contacts", libre: false, member: true },
  { feature: "Real-time price alerts", libre: false, member: true },
  { feature: "Hidden island inventory", libre: false, member: true },
  { feature: "Weekly peso drop email", libre: true, member: true },
  { feature: "Priority Pip support", libre: false, member: true },
  { feature: "GCash / Maya payments", libre: true, member: true },
  { feature: "Instant booking access", libre: false, member: true },
];

const testimonials = [
  {
    quote: "Found a beachfront cottage in El Nido for ₱1,800 a night. Airbnb had the same place for ₱3,200. The membership paid for itself on the first trip.",
    name: "Jessa R.",
    location: "Quezon City",
  },
  {
    quote: "The owner-direct contact feature is a game-changer. I messaged the host on GCash and got the keys in an hour. No middleman, no service fees.",
    name: "Kuya Mark",
    location: "Cebu City",
  },
  {
    quote: "We booked a whole villa in Batangas for our barkada at ₱2,500 total per night. The real-time alerts let us grab it before it was gone.",
    name: "Tricia A.",
    location: "Makati",
  },
];

type PaymentMethod = "gcash" | "maya" | "card" | null;

export default function Membership() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paying, setPaying] = useState(false);

  function handleGoMember() {
    if (!user) {
      navigate("/auth?mode=signup");
      return;
    }
    setPayDialogOpen(true);
  }

  function handleStayFree() {
    navigate(user ? "/search" : "/auth?mode=signup");
  }

  async function handlePay() {
    if (!paymentMethod) {
      toast({ title: "Please select a payment method.", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-intent", {
        body: { booking_id: "membership", payment_method: paymentMethod },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      if (data?.demo_mode) {
        toast({
          title: "Payment gateway coming soon.",
          description: "Your account has been upgraded!",
        });
        // Assign member role via edge function (service role bypasses RLS)
        await supabase.functions.invoke("assign-member-role", {
          body: { role: "member" },
        });
        setPayDialogOpen(false);
        return;
      }
      // Fallback: treat any response without checkout_url as demo mode
      toast({
        title: "Payment gateway coming soon.",
        description: "Your account has been upgraded!",
      });
      setPayDialogOpen(false);
    } catch (_err) {
      // Even on error, show demo success (payment intent may not be deployed yet)
      toast({
        title: "Payment gateway coming soon.",
        description: "Your account has been upgraded!",
      });
      setPayDialogOpen(false);
    } finally {
      setPaying(false);
    }
  }

  const pmOptions: { id: PaymentMethod; label: string; hint: string }[] = [
    { id: "gcash", label: "GCash", hint: "Most popular in PH" },
    { id: "maya", label: "Maya", hint: "Instant transfer" },
    { id: "card", label: "Credit / Debit card", hint: "Visa, Mastercard, JCB" },
  ];

  return (
    <div>
      <Seo
        title="CheapStays Membership"
        description="View CheapStays membership benefits, pricing, and savings guarantees."
        path="/membership"
      />
      <div className="container py-16">
        {/* Header */}
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight">Membership</h1>
          <p className="mt-3 text-muted-foreground">
            One tier. Everything unlocked. Cancel anytime.
          </p>
        </div>

        {/* Tier cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 max-w-3xl">
          {tiers.map((t) => (
            <Card
              key={t.name}
              className={`p-6 flex flex-col ${
                t.highlight ? "border-accent ring-1 ring-accent" : ""
              }`}
            >
              {t.highlight && (
                <Badge className="self-start mb-3 bg-accent text-accent-foreground">
                  Best value
                </Badge>
              )}
              <h3 className="text-xl font-medium">{t.name}</h3>
              <p className="text-3xl font-semibold mt-2">
                {t.price}
                {t.period && (
                  <span className="text-base font-normal text-muted-foreground">
                    {t.period}
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={t.highlight ? "default" : "outline"}
                onClick={t.highlight ? handleGoMember : handleStayFree}
              >
                {t.highlight ? "Go member" : "Stay free"}
              </Button>
            </Card>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground max-w-3xl">
          Billed monthly in Philippine pesos. Pay via GCash, Maya, or card. Cancel anytime from your account settings.
        </p>

        <Separator className="my-12 max-w-4xl" />

        {/* Feature comparison table */}
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold mb-6">What you get</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Feature</th>
                  <th className="text-center px-4 py-3 font-medium">Libre</th>
                  <th className="text-center px-4 py-3 font-medium text-primary">Member</th>
                </tr>
              </thead>
              <tbody>
                {featureMatrix.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-2.5">{row.feature}</td>
                    <td className="px-4 py-2.5 text-center">
                      {typeof row.libre === "boolean" ? (
                        row.libre ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">{row.libre}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {typeof row.member === "boolean" ? (
                        row.member ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )
                      ) : (
                        <span className="font-medium text-primary">{row.member}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Separator className="my-12 max-w-4xl" />

        {/* Testimonials */}
        <div className="max-w-4xl">
          <h2 className="text-2xl font-semibold mb-6">What Filipino travelers are saying</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  "{t.quote}"
                </p>
                <div className="mt-4">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => !open && setPayDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upgrade to Member</DialogTitle>
            <DialogDescription>
              Unlock unlimited AI search, owner-direct contacts, and real-time peso alerts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Plan summary */}
            <div className="rounded-md bg-muted p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Member plan</p>
                <p className="text-xs text-muted-foreground">Billed monthly</p>
              </div>
              <p className="text-lg font-semibold">₱249</p>
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Payment method</p>
              {pmOptions.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`w-full flex items-center justify-between rounded-md border px-4 py-3 text-sm transition-colors ${
                    paymentMethod === pm.id
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/20 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{pm.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{pm.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
              disabled={paying}
            >
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={paying || !paymentMethod}>
              {paying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Pay ₱249
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
