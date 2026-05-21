import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { Loader2, ArrowLeft, BedDouble, Bath, Users, CalendarDays, Zap, Star, CheckCircle2 } from "lucide-react";
import { ImageGallery } from "@/components/ImageGallery";
import { BookingPanel } from "@/components/BookingPanel";
import { ReviewList } from "@/components/ReviewList";
import { GuestRatingBadge } from "@/components/GuestRatingBadge";

type Listing = {
  id: string;
  host_id: string;
  title: string;
  slug: string | null;
  description: string;
  type: string;
  city: string;
  province: string;
  address: string | null;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_php: number;
  min_nights: number;
  amenities: string[];
  images: string[];
  video_url: string | null;
  is_owner_direct: boolean;
  instant_book: boolean;
  status: string;
  avg_rating: number | null;
  review_count: number;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  entire_place: "Entire place",
  private_room: "Private room",
  shared_room: "Shared room",
  villa: "Villa",
  glamping: "Glamping",
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", aircon: "Air conditioning", fan: "Fan",
  kitchen: "Full kitchen", kitchenette: "Kitchenette", kitchen_shared: "Shared kitchen",
  hot_water: "Hot water", outdoor_shower: "Outdoor shower", parking: "Free parking",
  pool: "Swimming pool", private_pool: "Private pool", rooftop_pool: "Rooftop pool",
  gym: "Gym", work_desk: "Work desk", smart_tv: "Smart TV", tv: "TV",
  breakfast_included: "Breakfast included", pet_friendly: "Pet friendly",
  beach_access: "Beach access", hammock: "Hammock", kayak: "Kayak",
  snorkel_gear: "Snorkel gear", bike_rental: "Bike rental", bbq_grill: "BBQ grill",
  fire_pit: "Fire pit", fireplace: "Fireplace", garden: "Garden", terrace: "Terrace",
  board_rack: "Surf board rack", cultural_tour: "Cultural tour", heritage_tour: "Heritage tour",
  farm_tour: "Farm tour", lake_view: "Lake view", volcano_view: "Volcano view",
  housekeeper_available: "Housekeeper on request", daily_housekeeping: "Daily housekeeping",
  electric_blankets: "Electric blankets", no_aircon_needed: "Cool climate (no A/C needed)",
};

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setListing(data as Listing);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="container py-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="container py-24 text-center">
        <p className="text-xl font-medium">Listing not found</p>
        <p className="text-muted-foreground mt-2">It may have been removed or the link is incorrect.</p>
        <Link to="/search">
          <Button className="mt-6" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to search
          </Button>
        </Link>
      </div>
    );
  }

  const amenityList = (listing.amenities ?? []).filter((a) => AMENITY_LABELS[a]);
  const unknownAmenities = (listing.amenities ?? []).filter((a) => !AMENITY_LABELS[a]);

  return (
    <div>
      <Seo
        title={`${listing.title} · CheapStays`}
        description={listing.description || `${listing.bedrooms}BR in ${listing.city} — ₱${listing.nightly_php}/night, owner-direct.`}
        path={`/listing/${listing.id}`}
      />

      <div className="container py-10 max-w-6xl">
        <Link to="/search" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>

        {listing.images?.length > 0 ? (
          <div className="mb-8">
            <ImageGallery images={listing.images} title={listing.title} />
          </div>
        ) : (
          <div className="rounded-2xl h-64 bg-gradient-to-br from-secondary/60 to-accent/10 flex items-center justify-center mb-8">
            <span className="text-7xl opacity-20 select-none">
              {listing.type === "villa" ? "🏡" : listing.type === "glamping" ? "⛺" : "🏠"}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:items-start">

          {/* ── Left column ── */}
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary">{TYPE_LABELS[listing.type] ?? listing.type}</Badge>
                  {listing.is_owner_direct && <Badge variant="outline">Owner direct</Badge>}
                  {listing.instant_book && (
                    <Badge className="bg-primary text-primary-foreground gap-1">
                      <Zap className="h-3 w-3" /> Instant book
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
                <p className="text-muted-foreground mt-1">
                  {listing.city}, {listing.province}
                  {listing.address && ` · ${listing.address}`}
                </p>
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
              </div>
            </div>

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

            {listing.description && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-3">About this place</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{listing.description}</p>
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
              <h2 className="text-lg font-medium">Stay details</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Minimum stay: {listing.min_nights} {listing.min_nights === 1 ? "night" : "nights"}
              </div>
              {listing.is_owner_direct && (
                <p className="text-sm text-muted-foreground">
                  This is an owner-direct listing — you deal with the host directly, no middleman fees.
                </p>
              )}
            </div>

            {listing.video_url && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-3">Video tour</h2>
                <video
                  src={listing.video_url}
                  controls
                  className="w-full rounded-xl border border-border/60 max-h-80 bg-black"
                />
              </div>
            )}

            <div className="mb-8 border-t border-border/60 pt-8">
              <ReviewList listingId={listing.id} hostId={listing.host_id} />
            </div>
          </div>

          {/* ── Right column: sticky booking panel ── */}
          <div className="lg:sticky lg:top-24">
            <BookingPanel
              listing={{
                id: listing.id,
                nightly_php: listing.nightly_php,
                min_nights: listing.min_nights,
                max_guests: listing.max_guests,
                instant_book: listing.instant_book,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
