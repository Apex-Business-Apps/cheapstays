// Shared display constants + full Listing shape used by both the standard
// listing page and any surface that renders the same detail view (voucher
// deals, promo pages, etc.). Keep this file constants-only so react-refresh
// stays happy in component files.

export type Listing = {
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
  short_term_enabled?: boolean;
  long_term_enabled?: boolean;
  max_nights?: number | null;
  status: string;
  avg_rating: number | null;
  review_count: number;
  created_at: string;
  stay_availability_type?: "overnight" | "hourly" | "both" | null;
  stay_category?: string | null;
  booking_mode?: "instant" | "voucher" | "manual_review" | null;
  hourly_php?: number | null;
  price_3h?: number | null;
  price_6h?: number | null;
  price_12h?: number | null;
  promo_price?: number | null;
  overnight_php?: number | null;
};

export const TYPE_LABELS: Record<string, string> = {
  entire_place: "Entire place",
  private_room: "Private room",
  shared_room: "Shared room",
  villa: "Villa",
  glamping: "Glamping",
};

export const AMENITY_LABELS: Record<string, string> = {
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
