import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, BedDouble, Bath, Users, CalendarDays, Star, CheckCircle2, ScrollText, Ticket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListingPhotoCarousel } from "@/components/ListingPhotoCarousel";
import { ReviewList } from "@/components/ReviewList";
import { GuestRatingBadge } from "@/components/GuestRatingBadge";
import { VoucherPurchaseForm } from "@/components/stay-vouchers/VoucherPurchaseForm";
import { AMENITY_LABELS, TYPE_LABELS, type Listing } from "@/lib/listing-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type BatchRow = {
  id: string;
  batch_name: string;
  nights: number;
  price_php: number;
  quantity: number;
  valid_days: number;
  terms: string | null;
  is_active: boolean;
  listing_id: string;
};

export default function StayVoucherDetailPage() {
  const { batchId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [batch, setBatch] = useState<BatchRow | null | undefined>(undefined);
  const [listing, setListing] = useState<Listing | null>(null);
  const [houseRules, setHouseRules] = useState<string | null>(null);
  const [soldCount, setSoldCount] = useState<number>(0);

  // Surface the outcome when a buyer returns from a cancelled PayMongo checkout,
  // then clear the param so it doesn't re-fire on refresh.
  useEffect(() => {
    if (searchParams.get("cancelled") === "1") {
      toast.error("Payment cancelled — you weren't charged. Try again when you're ready.");
      searchParams.delete("cancelled");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    (async () => {
      const { data: b } = await supabase
        .from("stay_voucher_batches")
        .select("id, batch_name, nights, price_php, quantity, valid_days, terms, is_active, listing_id")
        .eq("id", batchId)
        .maybeSingle();
      if (cancelled) return;
      if (!b) { setBatch(null); return; }
      setBatch(b as BatchRow);
      const [{ data: l }, { data: stock }] = await Promise.all([
        supabase.from("listings").select("*").eq("id", b.listing_id).eq("status", "active").maybeSingle(),
        supabase.rpc("get_stay_voucher_batch_stock", { p_batch_ids: [b.id] }),
      ]);
      if (cancelled) return;
      setListing((l as Listing | null) ?? null);
      const firstRow = (stock as { batch_id: string; sold_or_held: number }[] | null)?.[0];
      setSoldCount(firstRow?.sold_or_held ?? 0);
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  useEffect(() => {
    if (!listing?.id) return;
    let cancelled = false;
    sb.from("listing_house_rules")
      .select("rules_json")
      .eq("listing_id", listing.id)
      .maybeSingle()
      .then(({ data }: { data: { rules_json?: { text?: string } } | null }) => {
        if (cancelled) return;
        const text = data?.rules_json?.text?.trim();
        setHouseRules(text ? text : null);
      });
    return () => { cancelled = true; };
  }, [listing?.id]);

  if (batch === undefined) {
    return <div className="container py-10"><Skeleton className="h-96" /></div>;
  }

  if (batch === null || !batch.is_active) {
    return (
      <div className="container py-16 text-center max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Voucher not available</h1>
        <p className="text-sm text-muted-foreground mb-4">This deal is no longer active.</p>
        <Link to="/stay-vouchers" className="text-sm text-primary hover:underline">Browse other vouchers</Link>
      </div>
    );
  }

  const amenityList = (listing?.amenities ?? []).filter((a) => AMENITY_LABELS[a]);
  const unknownAmenities = (listing?.amenities ?? []).filter((a) => !AMENITY_LABELS[a]);
  const savings = listing?.nightly_php
    ? Math.max(0, listing.nightly_php * batch.nights - batch.price_php)
    : 0;

  return (
    <div>
      <Seo
        title={`${batch.batch_name} · CheapStays`}
        description={listing?.description
          ? listing.description.slice(0, 160)
          : `Voucher deal for ${listing?.title ?? "a stay"} — ${batch.nights} night${batch.nights === 1 ? "" : "s"} at ₱${batch.price_php.toLocaleString()}.`}
        path={`/stay-vouchers/${batch.id}`}
      />

      <div className="container py-10 max-w-6xl">
        <Link
          to="/stay-vouchers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All voucher deals
        </Link>

        {listing?.images && listing.images.length > 0 ? (
          <div className="mb-8">
            <ListingPhotoCarousel images={listing.images} title={listing.title} variant="hero" />
          </div>
        ) : (
          <div className="rounded-2xl h-64 bg-gradient-to-br from-secondary/60 to-accent/10 flex items-center justify-center mb-8">
            <span className="text-7xl opacity-20 select-none">🏠</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:items-start">

          {/* ── Left column ── */}
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <Ticket className="h-3 w-3" /> Voucher deal
                  </Badge>
                  {listing?.type && (
                    <Badge variant="secondary">{TYPE_LABELS[listing.type] ?? listing.type}</Badge>
                  )}
                  {listing?.is_owner_direct && <Badge variant="outline">Owner direct</Badge>}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {listing?.title ?? batch.batch_name}
                </h1>
                {listing && (
                  <p className="text-muted-foreground mt-1">
                    {listing.city}, {listing.province}
                    {listing.address && ` · ${listing.address}`}
                  </p>
                )}
                {listing && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {listing.avg_rating && (
                      <p className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{listing.avg_rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({listing.review_count} reviews)</span>
                      </p>
                    )}
                    <GuestRatingBadge userId={listing.host_id} size="md" />
                  </div>
                )}
              </div>
            </div>

            {listing && (
              <div className="grid grid-cols-3 gap-4 py-5 border-y border-border/60 mb-8">
                <div className="flex flex-col items-center gap-1 text-center">
                  <BedDouble className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">{listing.bedrooms}</p>
                  <p className="text-xs text-muted-foreground">{listing.bedrooms === 1 ? "bedroom" : "bedrooms"}</p>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <Bath className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">{listing.bathrooms}</p>
                  <p className="text-xs text-muted-foreground">{listing.bathrooms === 1 ? "bathroom" : "bathrooms"}</p>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">{listing.max_guests}</p>
                  <p className="text-xs text-muted-foreground">max guests</p>
                </div>
              </div>
            )}

            {listing?.description && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-3">About this place</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {listing.description}
                </p>
              </div>
            )}

            {(amenityList.length > 0 || unknownAmenities.length > 0) && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-3">What's included</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {amenityList.map((a) => (
                    <div key={a} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span>{AMENITY_LABELS[a]}</span>
                    </div>
                  ))}
                  {unknownAmenities.map((a) => (
                    <div key={a} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="capitalize">{a.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8 rounded-xl border border-border/60 p-5 space-y-3">
              <h2 className="text-lg font-medium">Voucher details</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {batch.nights} night{batch.nights === 1 ? "" : "s"} · redeem within {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"} of purchase
              </div>
              {savings > 0 && listing && (
                <p className="text-sm text-muted-foreground">
                  Listing normally ₱{(listing.nightly_php * batch.nights).toLocaleString()} for {batch.nights} night{batch.nights === 1 ? "" : "s"} —
                  <span className="text-primary font-medium"> save ₱{savings.toLocaleString()}</span> with this voucher.
                </p>
              )}
              {batch.terms && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{batch.terms}</p>
              )}
            </div>

            {/* ── Policies ── */}
            <div className="mb-8">
              <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-muted-foreground" /> Policies
              </h2>
              <div className="rounded-xl border border-border/60 divide-y divide-border/60">
                {houseRules && (
                  <div className="p-5">
                    <p className="font-medium text-sm mb-1">House rules</p>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{houseRules}</p>
                  </div>
                )}
                <div className="p-5">
                  <p className="font-medium text-sm mb-1">Voucher policy</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Non-refundable. Valid for {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"} from purchase.
                    Redeem in person with the host at check-in — bring your code by email or from the success page.
                  </p>
                </div>
              </div>
            </div>

            {listing?.video_url && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-3">Video tour</h2>
                <video
                  src={listing.video_url}
                  controls
                  className="w-full rounded-xl border border-border/60 max-h-80 bg-black"
                />
              </div>
            )}

            {listing && (
              <div className="mb-8 border-t border-border/60 pt-8">
                <ReviewList listingId={listing.id} hostId={listing.host_id} />
              </div>
            )}
          </div>

          {/* ── Right column: sticky voucher purchase card ── */}
          <div className="lg:sticky lg:top-24">
            <Card className="p-5 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{batch.batch_name}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-semibold">₱{batch.price_php.toLocaleString()}</p>
                  {savings > 0 && listing && (
                    <p className="text-sm text-muted-foreground line-through">
                      ₱{(listing.nightly_php * batch.nights).toLocaleString()}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {batch.nights} night{batch.nights === 1 ? "" : "s"} · one voucher
                </p>
                {savings > 0 && listing && (
                  <Badge className="mt-2 bg-primary/10 text-primary hover:bg-primary/10 border-0">
                    Save ₱{savings.toLocaleString()} (
                    {Math.round((savings / (listing.nightly_php * batch.nights)) * 100)}% off)
                  </Badge>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  {soldCount >= batch.quantity
                    ? "All vouchers in this batch have been sold."
                    : `${Math.max(batch.quantity - soldCount, 0)} of ${batch.quantity} left`}
                </p>
              </div>
              {soldCount >= batch.quantity ? (
                <div className="space-y-2">
                  <Button disabled className="w-full min-h-[44px]">Sold out</Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Check back — the host may add more. <Link to="/stay-vouchers" className="text-primary underline">Browse other vouchers</Link>
                  </p>
                </div>
              ) : (
                <VoucherPurchaseForm batch={{
                  id: batch.id, batch_name: batch.batch_name, nights: batch.nights,
                  price_php: batch.price_php, valid_days: batch.valid_days,
                  listing_title: listing?.title ?? batch.batch_name,
                }} />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
