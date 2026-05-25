/** Shared Pip / AiChatBubble type definitions */

export type SearchListing = {
  id: string;
  slug: string;
  title: string;
  city: string;
  province: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_php: number;
  min_nights: number;
  max_nights?: number | null;
  amenities: string[];
  images: string[];
  short_term_enabled?: boolean | null;
  long_term_enabled?: boolean | null;
  /** @deprecated legacy flag — routing is by nights, not this column */
  is_owner_direct?: boolean;
  /** @deprecated legacy flag — routing is by nights, not this column */
  instant_book?: boolean;
  avg_rating: number | null;
  review_count: number | null;
  why_its_a_deal: string;
  score: number;
};

/** Text message (user or assistant streaming). */
export type TextMsg = {
  kind: "text";
  role: "user" | "assistant";
  content: string;
};

/** AI-search results: summary header + structured listing cards. */
export type ResultsMsg = {
  kind: "results";
  summary: string;
  listings: SearchListing[];
};

/** Booking confirmation inserted after book-listing succeeds. */
export type BookingDoneMsg = {
  kind: "booking";
  booking_id: string;
  listing_title: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_php: number;
  status: "confirmed" | "pending";
};

export type PipMsg = TextMsg | ResultsMsg | BookingDoneMsg;

/** Booking flow state machine (kept in AiChatBubble state, not in messages). */
export type BookFlow =
  | { step: "idle" }
  | { step: "form"; listing: SearchListing }
  | { step: "paying"; booking_id: string; total_php: number; listing_title: string };
