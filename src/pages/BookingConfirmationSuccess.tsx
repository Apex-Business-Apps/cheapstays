import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { KlookWidget } from "@/components/KlookWidget";

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

const getKlookCityId = (city: string): string => {
  return CITY_TO_KLOOK_ID[city] || "97"; // Defaulting to 97
};

export default function BookingConfirmationSuccess() {
  // Hardcoded mock values for the view
  const mockBooking = {
    id: "BKG-8472-X9",
    totalPaid: "4,250.00",
    city: "Manila",
  };

  const klookCityId = getKlookCityId(mockBooking.city);

  return (
    <div className="container py-16 max-w-3xl">
      <div className="text-center mb-8">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Thank you for choosing CheapStays. We have sent a confirmation email to your inbox.
        </p>
      </div>

      <Card className="p-6 mb-8 bg-card border-border shadow-sm">
        <h2 className="text-xl font-medium mb-4 border-b border-border pb-2">
          Receipt Summary
        </h2>
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted-foreground">Confirmation ID</span>
          <span className="font-medium">{mockBooking.id}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted-foreground">Destination</span>
          <span className="font-medium">{mockBooking.city}</span>
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
          <span className="text-lg font-semibold">Total Paid</span>
          <span className="text-lg font-semibold text-primary">
            ₱ {mockBooking.totalPaid}
          </span>
        </div>
      </Card>

      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-center">
          Enhance your stay in {mockBooking.city}
        </h3>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Check out top tours and activities in {mockBooking.city} hand-picked for you.
        </p>

        {/* Klook Widget Integration */}
        <div className="min-h-[400px] flex justify-center w-full bg-muted/20 rounded-lg p-2 border border-border">
          <KlookWidget cityId={klookCityId} />
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <Button asChild variant="outline" className="mr-4">
          <Link to="/">Back to Home</Link>
        </Button>
        <Button asChild>
          <Link to="/my-bookings">View My Bookings</Link>
        </Button>
      </div>
    </div>
  );
}
