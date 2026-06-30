import { CheckCircle2, Mail, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { KlookWidget } from "@/components/KlookWidget";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";

const CITY_TO_KLOOK_ID: Record<string, string> = {
  Manila: "35",
  Cebu: "38",
  Boracay: "39",
  Palawan: "40",
  Bohol: "41",
  Siargao: "219",
  Tagaytay: "138",
  Baguio: "140",
  "Puerto Princesa": "40",
  Coron: "215",
  ElNido: "216",
  Davao: "143",
  Iloilo: "145",
  Bacolod: "146",
};

const getKlookCityId = (city: string): string => CITY_TO_KLOOK_ID[city] || "97";

export default function BookingConfirmationSuccess() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const bookingId = searchParams.get("booking") ?? "";
  const email = searchParams.get("email") ?? "";
  const amount = Number(searchParams.get("amount")) || 0;
  const title = searchParams.get("title") ?? "";
  const city = searchParams.get("city") ?? "";
  // Guests arrive without a session — show account/sign-in guidance for them.
  const isGuest = searchParams.get("guest") === "1" || !user;

  const confirmationRef = bookingId ? `#${bookingId.slice(0, 8).toUpperCase()}` : "—";

  return (
    <div className="container py-16 max-w-3xl">
      <Seo title="Booking Confirmed · CheapStays" description="Your CheapStays booking is confirmed." path="/booking-success" />

      <div className="text-center mb-8">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Thank you for choosing CheapStays. Your payment was received successfully.
        </p>
      </div>

      {/* Email + account guidance */}
      <Card className="p-5 mb-6 bg-card border-border shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Check your email for the receipt</p>
            <p className="text-sm text-muted-foreground">
              We've sent your booking details and payment receipt
              {email ? <> to <span className="font-medium text-foreground">{email}</span></> : " to your inbox"}.
              It may take a minute to arrive — please check spam too.
            </p>
          </div>
        </div>

        {isGuest && (
          <div className="flex items-start gap-3 mt-4 pt-4 border-t border-border">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">We created an account for you</p>
              <p className="text-sm text-muted-foreground">
                Use the secure sign-in link in that email to view and manage your booking —
                no password needed. You can set a password anytime from your account.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Receipt summary */}
      <Card className="p-6 mb-8 bg-card border-border shadow-sm">
        <h2 className="text-xl font-medium mb-4 border-b border-border pb-2">
          Receipt Summary
        </h2>
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted-foreground">Confirmation ID</span>
          <span className="font-medium">{confirmationRef}</span>
        </div>
        {title && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">Property</span>
            <span className="font-medium text-right">{title}</span>
          </div>
        )}
        {city && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">Destination</span>
            <span className="font-medium">{city}</span>
          </div>
        )}
        {amount > 0 && (
          <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
            <span className="text-lg font-semibold">Total Paid</span>
            <span className="text-lg font-semibold text-primary">
              ₱ {amount.toLocaleString()}
            </span>
          </div>
        )}
      </Card>

      {city && (
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4 text-center">
            Enhance your stay in {city}
          </h3>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Check out top tours and activities in {city} hand-picked for you.
          </p>
          <div className="min-h-[400px] flex justify-center w-full bg-muted/20 rounded-lg p-2 border border-border">
            <KlookWidget cityId={getKlookCityId(city)} />
          </div>
        </div>
      )}

      <div className="flex justify-center mt-8">
        <Button asChild variant="outline" className="mr-4">
          <Link to="/">Back to Home</Link>
        </Button>
        {user ? (
          <Button asChild>
            <Link to="/my-bookings">View My Bookings</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/auth?mode=signin">Sign in to manage booking</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
