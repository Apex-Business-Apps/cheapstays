import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const FEATURE_MATRIX: { key: string; libre: boolean | "per_day"; member: boolean | "unlimited" }[] = [
  { key: "ai_search",        libre: "per_day",  member: "unlimited" },
  { key: "public_listings",  libre: true,       member: true },
  { key: "owner_contacts",   libre: false,      member: true },
  { key: "price_alerts",     libre: false,      member: true },
  { key: "hidden_inventory", libre: false,      member: true },
  { key: "weekly_email",     libre: true,       member: true },
  { key: "pip_support",      libre: false,      member: true },
  { key: "gcash_maya",       libre: true,       member: true },
  { key: "instant_booking",  libre: false,      member: true },
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
  const { t } = useTranslation();
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paying, setPaying] = useState(false);

  function handleGoMember() {
    if (!user) { navigate("/auth?mode=signup"); return; }
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
      const { data, error } = await supabase.functions.invoke("membership-payment-intent", {
        body: { payment_method: paymentMethod },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      toast({
        title: "Payment Unavailable",
        description: "Online payment is currently unavailable. Please try again later.",
        variant: "destructive",
      });
      setPayDialogOpen(false);
    } catch (err) {
      toast({
        title: "Payment Error",
        description: (err as Error).message || "Online payment is currently unavailable. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setPaying(false);
    }
  }

  const pmOptions: { id: PaymentMethod; label: string; hint: string }[] = [
    { id: "gcash", label: "GCash",                    hint: t("membership.gcash_hint") },
    { id: "maya",  label: "Maya",                     hint: t("membership.maya_hint") },
    { id: "card",  label: t("membership.card_label"), hint: t("membership.card_hint") },
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
          <h1 className="text-4xl font-semibold tracking-tight">{t("membership.heading")}</h1>
          <p className="mt-3 text-muted-foreground">{t("membership.subheading")}</p>
        </div>

        {/* Tier cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 max-w-3xl">
          {/* Libre */}
          <Card className="p-6 flex flex-col">
            <h3 className="text-xl font-medium">{t("membership.col_libre")}</h3>
            <p className="text-3xl font-semibold mt-2">₱0</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("membership.tier_libre_blurb")}</p>
            <ul className="mt-4 space-y-2 text-sm flex-1">
              {["AI search (5 searches/day)", "Public PH listings", "Weekly peso drop email"].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-6" variant="outline" onClick={handleStayFree}>
              {t("membership.tier_libre_cta")}
            </Button>
          </Card>

          {/* Member */}
          <Card className="p-6 flex flex-col border-accent ring-1 ring-accent">
            <Badge className="self-start mb-3 bg-accent text-accent-foreground">
              {t("membership.tier_badge")}
            </Badge>
            <h3 className="text-xl font-medium">{t("membership.col_member")}</h3>
            <p className="text-3xl font-semibold mt-2">
              ₱249
              <span className="text-base font-normal text-muted-foreground">{t("membership.period")}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("membership.tier_member_blurb")}</p>
            <ul className="mt-4 space-y-2 text-sm flex-1">
              {["Unlimited AI search", "Real-time peso alerts", "Owner-direct host contacts", "Hidden island inventory", "Priority Pip support"].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-6" onClick={handleGoMember}>
              {t("membership.tier_member_cta")}
            </Button>
          </Card>
        </div>

        <p className="mt-4 text-xs text-muted-foreground max-w-3xl">
          {t("membership.billing_note")}
        </p>

        <Separator className="my-12 max-w-4xl" />

        {/* Feature comparison table */}
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold mb-6">{t("membership.what_you_get")}</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Feature</th>
                  <th className="text-center px-4 py-3 font-medium">{t("membership.col_libre")}</th>
                  <th className="text-center px-4 py-3 font-medium text-primary">{t("membership.col_member")}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row, i) => (
                  <tr key={row.key} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-2.5">{t(`membership.${row.key}`)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {row.libre === "per_day" ? (
                        <span className="text-muted-foreground">{t("membership.per_day")}</span>
                      ) : row.libre ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.member === "unlimited" ? (
                        <span className="font-medium text-primary">{t("membership.unlimited")}</span>
                      ) : row.member ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">--</span>
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
          <h2 className="text-2xl font-semibold mb-6">{t("membership.testimonials_heading")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((tm) => (
              <Card key={tm.name} className="p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">"{tm.quote}"</p>
                <div className="mt-4">
                  <p className="text-sm font-semibold">{tm.name}</p>
                  <p className="text-xs text-muted-foreground">{tm.location}</p>
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
            <DialogTitle>{t("membership.dialog_title")}</DialogTitle>
            <DialogDescription>{t("membership.dialog_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("membership.plan_name")}</p>
                <p className="text-xs text-muted-foreground">{t("membership.plan_billing")}</p>
              </div>
              <p className="text-lg font-semibold">₱249</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("membership.payment_method")}</p>
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
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} disabled={paying}>
              {t("membership.cancel")}
            </Button>
            <Button onClick={handlePay} disabled={paying || !paymentMethod}>
              {paying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("membership.pay_cta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
