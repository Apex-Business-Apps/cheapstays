// Demo listings used to populate discovery + search surfaces when the real DB
// is sparse (dev/preview) or when a category has no active real listings.
//
// Sentinel: every id and slug starts with "demo-". ListingDetail short-circuits
// its Supabase fetch when the URL param matches, and BookingPanel disables its
// CTA — so a demo listing is never bookable (no book-listing / guest-book-listing
// call is ever fired against a fake listing_id).

import type { Listing } from "@/lib/listing-display";
import type { DiscoveryListing } from "@/lib/discovery";

// Superset of both DiscoveryListing and Listing so the same object can hydrate
// either surface. Extra fields (bedrooms, description, etc.) are used by the
// detail page; discovery only reads the DiscoveryListing subset.
export type DummyListing = Listing;

/** True when a slug/id belongs to the demo dataset. Cheap and pure. */
export function isDemoListingKey(key: string | null | undefined): boolean {
  return typeof key === "string" && key.startsWith("demo-");
}

// Curated Unsplash images grouped by stay type. Each demo listing pulls a
// small hero set from the group matching its `stay_category` / `type` so a
// villa never renders as a hostel dorm.
const IMG = {
  apartment: [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1600&q=80",
  ],
  condo: [
    "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1522156373667-4c7234bbd804?auto=format&fit=crop&w=1600&q=80",
  ],
  villa: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1600&q=80",
  ],
  private_pool: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1600&q=80",
  ],
  hostel: [
    "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1590490350009-9ab08b6a5d47?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1600&q=80",
  ],
  hotel_room: [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&q=80",
  ],
  motel_room: [
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1520277739336-7bf67edfa768?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1600&q=80",
  ],
  glamping: [
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1600&q=80",
  ],
  resort: [
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1439130490301-25e322d88054?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1600&q=80",
  ],
  quick_stay: [
    "https://images.unsplash.com/photo-1631049035182-249067d7618e?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1600&q=80",
  ],
} as const;

type StayCategory = keyof typeof IMG;

// Row template — all optional fields are filled in mk() so listings satisfy
// both DiscoveryListing (used by home page + Search) and Listing (detail page).
type Row = {
  slug: string;
  title: string;
  city: string;
  province: string;
  type: "entire_place" | "private_room" | "shared_room" | "villa" | "glamping" | "resort";
  category: StayCategory;
  availability: "overnight" | "hourly" | "both";
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  min_nights: number;
  nightly_php: number;
  promo_php?: number;
  hourly_php?: number;
  price_3h?: number;
  price_6h?: number;
  price_12h?: number;
  amenities: string[];
  description: string;
  rating: number;
  reviews: number;
};

const HOST_ID = "00000000-0000-0000-0000-0000000000de"; // demo host, never used server-side

function mk(row: Row): DummyListing {
  const imgs = IMG[row.category];
  // Rotate through the group so every listing in the same category doesn't
  // share an identical hero. Deterministic per slug.
  const seed = [...row.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rotated = [...imgs.slice(seed % imgs.length), ...imgs.slice(0, seed % imgs.length)];
  return {
    id: `demo-${row.slug}`,
    slug: `demo-${row.slug}`,
    host_id: HOST_ID,
    title: row.title,
    description: row.description,
    type: row.type,
    city: row.city,
    province: row.province,
    address: null,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    max_guests: row.max_guests,
    nightly_php: row.nightly_php,
    min_nights: row.min_nights,
    amenities: row.amenities,
    images: rotated,
    video_url: null,
    is_owner_direct: true,
    instant_book: true,
    short_term_enabled: true,
    long_term_enabled: false,
    max_nights: null,
    status: "active",
    avg_rating: row.rating,
    review_count: row.reviews,
    created_at: new Date().toISOString(),
    stay_availability_type: row.availability,
    stay_category: row.category,
    booking_mode: "instant",
    hourly_php: row.hourly_php ?? null,
    price_3h: row.price_3h ?? null,
    price_6h: row.price_6h ?? null,
    price_12h: row.price_12h ?? null,
    promo_price: row.promo_php ?? null,
    overnight_php: row.nightly_php,
  };
}

// 40 hand-picked listings covering every stay type and Philippine destinations.
export const DUMMY_LISTINGS: DummyListing[] = [
  // ── Villas & private-pool (7)
  mk({ slug: "el-nido-cliffside-villa", title: "Cliffside villa above Bacuit Bay", city: "El Nido", province: "Palawan", type: "villa", category: "villa", availability: "overnight", bedrooms: 3, bathrooms: 3, max_guests: 6, min_nights: 2, nightly_php: 12800, promo_php: 9900, amenities: ["wifi", "aircon", "kitchen", "pool", "beach_access", "parking"], description: "Three-bedroom villa carved into the limestone above the bay. Wake up to karst views, swim in the infinity pool by lunch, and end the day on a private terrace watching the sun drop behind Cadlao Island.", rating: 4.92, reviews: 148 }),
  mk({ slug: "siargao-surf-villa", title: "Surf villa a minute from Cloud 9", city: "General Luna", province: "Surigao del Norte", type: "villa", category: "villa", availability: "overnight", bedrooms: 2, bathrooms: 2, max_guests: 4, min_nights: 3, nightly_php: 7800, amenities: ["wifi", "aircon", "kitchen", "board_rack", "outdoor_shower", "hammock"], description: "Two-bedroom bamboo-and-concrete villa steps from the Cloud 9 boardwalk. Outdoor shower, board rack, hammock deck — designed for surfers who also want a real bed.", rating: 4.85, reviews: 92 }),
  mk({ slug: "boracay-station-1-villa", title: "White Beach Station 1 villa", city: "Malay", province: "Aklan", type: "villa", category: "private_pool", availability: "overnight", bedrooms: 4, bathrooms: 4, max_guests: 8, min_nights: 2, nightly_php: 18500, promo_php: 14900, amenities: ["wifi", "aircon", "kitchen", "private_pool", "beach_access", "housekeeper_available"], description: "Four-bedroom family villa two blocks from Station 1's powder-fine sand. Private plunge pool, full kitchen, daily housekeeping on request.", rating: 4.88, reviews: 71 }),
  mk({ slug: "tagaytay-ridge-pool-villa", title: "Ridge-view pool villa in Tagaytay", city: "Tagaytay", province: "Cavite", type: "villa", category: "private_pool", availability: "overnight", bedrooms: 3, bathrooms: 3, max_guests: 6, min_nights: 1, nightly_php: 9200, amenities: ["wifi", "aircon", "kitchen", "private_pool", "volcano_view", "fireplace", "parking"], description: "Contemporary three-bedroom villa on the Tagaytay ridge with Taal Volcano views from the pool deck. Wood-burning fireplace, chef's kitchen, garage for two cars.", rating: 4.79, reviews: 54 }),
  mk({ slug: "coron-hilltop-villa", title: "Hilltop villa overlooking Coron Bay", city: "Coron", province: "Palawan", type: "villa", category: "villa", availability: "overnight", bedrooms: 2, bathrooms: 2, max_guests: 4, min_nights: 2, nightly_php: 6900, amenities: ["wifi", "aircon", "kitchen", "terrace", "parking"], description: "Two-bedroom hilltop retreat with a wraparound terrace framing Coron Bay's twin peaks. Ten minutes to the pier for island-hopping.", rating: 4.81, reviews: 63 }),
  mk({ slug: "batangas-beachfront-pool-house", title: "Beachfront pool house in Nasugbu", city: "Nasugbu", province: "Batangas", type: "villa", category: "private_pool", availability: "overnight", bedrooms: 4, bathrooms: 3, max_guests: 10, min_nights: 2, nightly_php: 14500, promo_php: 11900, amenities: ["wifi", "aircon", "kitchen", "private_pool", "beach_access", "bbq_grill", "parking"], description: "Beachfront pool house sleeping ten. Direct sand access, poolside grill, and a mango-shaded lawn wide enough for a barkada weekend.", rating: 4.9, reviews: 39 }),
  mk({ slug: "camiguin-lava-stone-villa", title: "Lava-stone villa on Camiguin's north coast", city: "Mambajao", province: "Camiguin", type: "villa", category: "villa", availability: "overnight", bedrooms: 2, bathrooms: 2, max_guests: 4, min_nights: 2, nightly_php: 5900, amenities: ["wifi", "aircon", "kitchen", "beach_access", "snorkel_gear"], description: "Two-bedroom villa built from local lava stone, opening onto a black-sand cove. Snorkel gear included; White Island boats a five-minute walk away.", rating: 4.83, reviews: 27 }),

  // ── Condos & apartments (10)
  mk({ slug: "bgc-signa-1br-skyline", title: "Signa 1BR with BGC skyline view", city: "Taguig", province: "Metro Manila", type: "entire_place", category: "condo", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 3400, amenities: ["wifi", "aircon", "kitchenette", "gym", "pool", "work_desk", "smart_tv"], description: "One-bedroom on the 34th floor of Signa Designer Residences — floor-to-ceiling glass, sunset skyline, and a kitchen fitted for real cooking. Walk to Bonifacio High Street.", rating: 4.76, reviews: 118 }),
  mk({ slug: "makati-avant-studio", title: "Avant serviced studio in Salcedo", city: "Makati", province: "Metro Manila", type: "entire_place", category: "condo", availability: "overnight", bedrooms: 0, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2600, promo_php: 2100, amenities: ["wifi", "aircon", "kitchenette", "gym", "pool", "work_desk"], description: "Compact serviced studio in Salcedo Village. Great desk setup, fast fibre, gym on the 6th floor. Ideal for a solo trip or workation week.", rating: 4.72, reviews: 204 }),
  mk({ slug: "poblacion-loft-apartment", title: "Loft apartment in the heart of Poblacion", city: "Makati", province: "Metro Manila", type: "entire_place", category: "apartment", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 3, min_nights: 1, nightly_php: 2900, amenities: ["wifi", "aircon", "kitchenette", "smart_tv", "work_desk"], description: "Double-height loft one street off the Poblacion bar strip. Exposed concrete, mezzanine bedroom, blackout curtains for the morning after.", rating: 4.68, reviews: 87 }),
  mk({ slug: "ortigas-adb-2br", title: "ADB-area 2BR family apartment", city: "Mandaluyong", province: "Metro Manila", type: "entire_place", category: "apartment", availability: "overnight", bedrooms: 2, bathrooms: 2, max_guests: 5, min_nights: 2, nightly_php: 3800, amenities: ["wifi", "aircon", "kitchen", "pool", "gym", "parking"], description: "Two-bedroom family unit near ADB and SM Megamall. Full kitchen, twin bathrooms, deeded parking. Comfortable for a family of five.", rating: 4.7, reviews: 63 }),
  mk({ slug: "cebu-it-park-1br", title: "1BR overlooking Cebu IT Park", city: "Cebu City", province: "Cebu", type: "entire_place", category: "condo", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2400, amenities: ["wifi", "aircon", "kitchenette", "pool", "gym", "work_desk"], description: "One-bedroom in Avida Riala with IT Park views. Steps to Ayala Center Cebu and the 24-hour food strip.", rating: 4.74, reviews: 96 }),
  mk({ slug: "iloilo-city-riverside-flat", title: "Riverside flat on the Iloilo Esplanade", city: "Iloilo City", province: "Iloilo", type: "entire_place", category: "apartment", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2200, amenities: ["wifi", "aircon", "kitchenette", "work_desk"], description: "Quiet one-bedroom on the Iloilo Esplanade. Morning runs along the river, La Paz batchoy ten minutes away.", rating: 4.66, reviews: 41 }),
  mk({ slug: "davao-abreeza-1br", title: "1BR at Abreeza Residences Davao", city: "Davao City", province: "Davao del Sur", type: "entire_place", category: "condo", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2300, amenities: ["wifi", "aircon", "kitchenette", "pool", "gym"], description: "One-bedroom connected to Abreeza Mall. Great base for exploring Samal Island day-trips.", rating: 4.71, reviews: 58 }),
  mk({ slug: "baguio-camp-john-hay-loft", title: "Loft cabin at Camp John Hay", city: "Baguio", province: "Benguet", type: "entire_place", category: "apartment", availability: "overnight", bedrooms: 2, bathrooms: 1, max_guests: 4, min_nights: 2, nightly_php: 3500, amenities: ["wifi", "kitchenette", "fireplace", "no_aircon_needed", "parking"], description: "Two-storey loft inside Camp John Hay — pine trees at the window, a working fireplace, and the cool climate that made you want to visit Baguio in the first place.", rating: 4.82, reviews: 134 }),
  mk({ slug: "dumaguete-boulevard-apartment", title: "Boulevard apartment steps from Rizal", city: "Dumaguete", province: "Negros Oriental", type: "entire_place", category: "apartment", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 1900, amenities: ["wifi", "aircon", "kitchenette", "work_desk"], description: "One-bedroom above a coffee shop on Rizal Boulevard. Sea view, ceiling fan, and every dive shop in town within a jeepney ride.", rating: 4.67, reviews: 49 }),
  mk({ slug: "vigan-heritage-flat", title: "Heritage flat on Calle Crisologo", city: "Vigan", province: "Ilocos Sur", type: "entire_place", category: "apartment", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2100, amenities: ["wifi", "aircon", "kitchenette", "heritage_tour"], description: "Restored 1800s Spanish-colonial flat directly on Calle Crisologo. Wooden floors, capiz windows, calesa clip-clopping past your balcony.", rating: 4.88, reviews: 72 }),

  // ── Hostels (5)
  mk({ slug: "siargao-cloud-9-hostel", title: "Cloud 9 surf hostel — dorm bed", city: "General Luna", province: "Surigao del Norte", type: "shared_room", category: "hostel", availability: "overnight", bedrooms: 1, bathrooms: 2, max_guests: 1, min_nights: 1, nightly_php: 950, amenities: ["wifi", "aircon", "kitchen_shared", "board_rack", "hammock"], description: "Six-bed mixed dorm at the top of the Cloud 9 boardwalk. Board rack, shared kitchen, and the loudest sunrise session in Siargao just outside.", rating: 4.61, reviews: 312 }),
  mk({ slug: "elnido-corong-corong-hostel", title: "Corong-Corong sunset hostel", city: "El Nido", province: "Palawan", type: "shared_room", category: "hostel", availability: "overnight", bedrooms: 1, bathrooms: 3, max_guests: 1, min_nights: 1, nightly_php: 890, amenities: ["wifi", "fan", "kitchen_shared", "beach_access", "hammock"], description: "Rooftop dorm two blocks from Corong-Corong beach. Best sunset spot in town, and Tour A boats pick you up from the corner.", rating: 4.58, reviews: 267 }),
  mk({ slug: "cebu-city-oslob-hostel", title: "Downtown Cebu backpacker hostel", city: "Cebu City", province: "Cebu", type: "shared_room", category: "hostel", availability: "overnight", bedrooms: 1, bathrooms: 4, max_guests: 1, min_nights: 1, nightly_php: 780, amenities: ["wifi", "aircon", "kitchen_shared", "work_desk"], description: "Eight-bed pod dorm downtown, walking distance to Colon and the Osmeña Circle jump-off for Oslob and Kawasan tours.", rating: 4.55, reviews: 421 }),
  mk({ slug: "la-union-san-juan-hostel", title: "San Juan surf shack — dorm bed", city: "San Juan", province: "La Union", type: "shared_room", category: "hostel", availability: "overnight", bedrooms: 1, bathrooms: 2, max_guests: 1, min_nights: 1, nightly_php: 850, amenities: ["wifi", "fan", "kitchen_shared", "board_rack", "beach_access"], description: "Beachfront dorm in Urbiztondo. Wake up, grab a board from the rack, cross the road to the break. Coffee is on the house.", rating: 4.63, reviews: 189 }),
  mk({ slug: "bohol-panglao-diver-hostel", title: "Panglao diver hostel — dorm bed", city: "Panglao", province: "Bohol", type: "shared_room", category: "hostel", availability: "overnight", bedrooms: 1, bathrooms: 3, max_guests: 1, min_nights: 1, nightly_php: 920, amenities: ["wifi", "aircon", "kitchen_shared", "beach_access", "snorkel_gear"], description: "Diver-run dorm five minutes from Alona Beach. Snorkel gear is free; the resident dive shop can put you on a boat by 7 AM.", rating: 4.6, reviews: 156 }),

  // ── Hotel & motel rooms (6)
  mk({ slug: "baguio-boutique-hotel-room", title: "Boutique king room in Baguio", city: "Baguio", province: "Benguet", type: "private_room", category: "hotel_room", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 3200, amenities: ["wifi", "hot_water", "smart_tv", "breakfast_included", "no_aircon_needed"], description: "Corner king room in a restored Session Road boutique hotel. Pine views, breakfast at the ground-floor café, an electric kettle for the mornings.", rating: 4.81, reviews: 88 }),
  mk({ slug: "makati-airport-transit-hotel", title: "Transit hotel room near NAIA-3", city: "Pasay", province: "Metro Manila", type: "private_room", category: "hotel_room", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2700, amenities: ["wifi", "aircon", "smart_tv", "hot_water"], description: "Airport hotel queen room, 10 minutes from NAIA Terminal 3. Blackout curtains, soundproof windows, 24-hour check-in.", rating: 4.62, reviews: 305 }),
  mk({ slug: "iloilo-heritage-hotel-room", title: "Heritage twin room in Iloilo", city: "Iloilo City", province: "Iloilo", type: "private_room", category: "hotel_room", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2500, amenities: ["wifi", "aircon", "smart_tv", "breakfast_included"], description: "Twin room in a heritage house near Plaza Libertad. Filipino breakfast included; walking distance to Molo Church and Camiña batchoyan.", rating: 4.74, reviews: 66 }),
  mk({ slug: "manila-drive-thru-motel", title: "Drive-in motel room — Quezon City", city: "Quezon City", province: "Metro Manila", type: "private_room", category: "motel_room", availability: "hourly", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 1600, hourly_php: 350, price_3h: 950, price_6h: 1500, price_12h: 2200, amenities: ["wifi", "aircon", "smart_tv", "hot_water", "parking"], description: "Private-garage motel room off EDSA. Book by the hour or overnight — arrival is discreet, checkout is flexible.", rating: 4.42, reviews: 512 }),
  mk({ slug: "cebu-3h-transit-motel", title: "Cebu transit motel — hourly rooms", city: "Cebu City", province: "Cebu", type: "private_room", category: "motel_room", availability: "hourly", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 1400, hourly_php: 300, price_3h: 800, price_6h: 1200, price_12h: 1900, amenities: ["wifi", "aircon", "smart_tv", "hot_water", "parking"], description: "Fresh transit rooms near the North Bus Terminal. Great short-stay if you're on an early ferry to Bohol or Camotes.", rating: 4.38, reviews: 287 }),
  mk({ slug: "davao-express-hotel-room", title: "Express hotel room downtown Davao", city: "Davao City", province: "Davao del Sur", type: "private_room", category: "hotel_room", availability: "both", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2100, hourly_php: 450, price_6h: 1400, amenities: ["wifi", "aircon", "smart_tv", "hot_water"], description: "Practical downtown room with hourly and overnight rates. Two blocks from People's Park, five from the Roxas night market.", rating: 4.55, reviews: 141 }),

  // ── Glamping (5)
  mk({ slug: "batanes-hillside-glamping", title: "Hillside glamping tent in Batanes", city: "Basco", province: "Batanes", type: "glamping", category: "glamping", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 2, nightly_php: 4200, amenities: ["wifi", "hot_water", "fireplace", "electric_blankets", "no_aircon_needed", "cultural_tour"], description: "Canvas tent on the Vayang rolling hills. Electric blankets for the cold nights, and cows for neighbours in the morning.", rating: 4.94, reviews: 42 }),
  mk({ slug: "rizal-treetop-glamping", title: "Treetop glamping dome in Rizal", city: "Tanay", province: "Rizal", type: "glamping", category: "glamping", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 3600, promo_php: 2900, amenities: ["wifi", "hot_water", "fire_pit", "hammock", "lake_view"], description: "Geodesic dome tucked into the Sierra Madre foothills, an hour and a half from Manila. Lake view, private fire pit, campfire kit included.", rating: 4.79, reviews: 96 }),
  mk({ slug: "coron-safari-tent", title: "Beachfront safari tent in Coron", city: "Coron", province: "Palawan", type: "glamping", category: "glamping", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 2, nightly_php: 4800, amenities: ["wifi", "fan", "hot_water", "beach_access", "kayak", "hammock"], description: "Safari tent on a private beach, kayak on the sand, hammock strung between the trees. Island-hopping boats leave from the reef edge.", rating: 4.87, reviews: 58 }),
  mk({ slug: "bohol-forest-glamping", title: "Forest glamping cabin near Chocolate Hills", city: "Carmen", province: "Bohol", type: "glamping", category: "glamping", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 3, min_nights: 1, nightly_php: 3900, amenities: ["wifi", "fan", "hot_water", "farm_tour", "no_aircon_needed"], description: "Bamboo-frame cabin twenty minutes from the Chocolate Hills viewpoint. Farm-to-table breakfast at the on-site kitchen.", rating: 4.83, reviews: 47 }),
  mk({ slug: "la-union-beach-glamping", title: "Beach glamping tent in San Juan", city: "San Juan", province: "La Union", type: "glamping", category: "glamping", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 3300, amenities: ["wifi", "fan", "hot_water", "beach_access", "board_rack", "fire_pit"], description: "Beachfront tent on a quiet stretch north of Urbiztondo. Board rack and outdoor rinse for surf mornings, fire pit for the sunset.", rating: 4.76, reviews: 61 }),

  // ── Resorts (4)
  mk({ slug: "el-nido-lagoon-resort", title: "Lagoon-view resort suite in El Nido", city: "El Nido", province: "Palawan", type: "resort", category: "resort", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 3, min_nights: 2, nightly_php: 7900, promo_php: 6400, amenities: ["wifi", "aircon", "pool", "beach_access", "breakfast_included", "kayak"], description: "Suite in a small boutique resort inside a private cove. Kayaks and paddleboards are free, and the reef is a fin-kick from the sand.", rating: 4.86, reviews: 128 }),
  mk({ slug: "panglao-alona-resort", title: "Alona Beach resort room", city: "Panglao", province: "Bohol", type: "resort", category: "resort", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 4600, amenities: ["wifi", "aircon", "pool", "beach_access", "breakfast_included"], description: "Second-floor room fifty metres from Alona Beach's main strip. Big pool, breakfast buffet, dive shop next door.", rating: 4.72, reviews: 214 }),
  mk({ slug: "camiguin-white-island-resort", title: "White Island view resort room", city: "Mambajao", province: "Camiguin", type: "resort", category: "resort", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 3, min_nights: 1, nightly_php: 3800, amenities: ["wifi", "aircon", "pool", "beach_access", "snorkel_gear", "bike_rental"], description: "Beach cottage looking straight at White Island's sandbar. Bikes and snorkel gear are complimentary.", rating: 4.78, reviews: 74 }),
  mk({ slug: "boracay-diniwid-resort", title: "Diniwid cove boutique resort", city: "Malay", province: "Aklan", type: "resort", category: "resort", availability: "overnight", bedrooms: 1, bathrooms: 1, max_guests: 2, min_nights: 2, nightly_php: 6900, promo_php: 5600, amenities: ["wifi", "aircon", "pool", "beach_access", "breakfast_included", "rooftop_pool"], description: "Cliffside boutique room above Diniwid Beach — the quiet end of Boracay. Rooftop plunge pool, breakfast served on your balcony.", rating: 4.84, reviews: 92 }),

  // ── Quick / hourly stays (3)
  mk({ slug: "makati-quick-stay-studio", title: "Makati CBD quick-stay studio", city: "Makati", province: "Metro Manila", type: "entire_place", category: "quick_stay", availability: "hourly", bedrooms: 0, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 2000, hourly_php: 400, price_3h: 1050, price_6h: 1600, price_12h: 2300, amenities: ["wifi", "aircon", "kitchenette", "smart_tv", "work_desk"], description: "Studio pod in Legaspi Village built for short work-blocks or a mid-day reset between meetings. Book by the block, no minimum overnight.", rating: 4.51, reviews: 178 }),
  mk({ slug: "cebu-it-park-day-office", title: "Day-office studio near Cebu IT Park", city: "Cebu City", province: "Cebu", type: "entire_place", category: "quick_stay", availability: "hourly", bedrooms: 0, bathrooms: 1, max_guests: 2, min_nights: 1, nightly_php: 1900, hourly_php: 350, price_3h: 950, price_6h: 1400, price_12h: 2000, amenities: ["wifi", "aircon", "kitchenette", "work_desk", "smart_tv"], description: "Compact quick-stay studio a block from Cebu IT Park's café strip. Perfect for a nap between a red-eye and a client meeting.", rating: 4.48, reviews: 132 }),
  mk({ slug: "bgc-hourly-suite", title: "BGC hourly meeting suite", city: "Taguig", province: "Metro Manila", type: "entire_place", category: "quick_stay", availability: "hourly", bedrooms: 1, bathrooms: 1, max_guests: 4, min_nights: 1, nightly_php: 2800, hourly_php: 550, price_3h: 1400, price_6h: 2100, price_12h: 2600, amenities: ["wifi", "aircon", "kitchenette", "smart_tv", "work_desk"], description: "One-bedroom hourly suite in BGC — bring the team, share the screen, get a couch nap in between sessions.", rating: 4.57, reviews: 96 }),
];

const BY_KEY = new Map<string, DummyListing>();
for (const l of DUMMY_LISTINGS) {
  BY_KEY.set(l.id, l);
  if (l.slug) BY_KEY.set(l.slug, l);
}

/** Look up a demo listing by its id or slug. Returns null if not found. */
export function findDummyListing(key: string | null | undefined): DummyListing | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/** Cast helper — a demo row also satisfies the narrower DiscoveryListing shape. */
export function toDiscoveryListing(l: DummyListing): DiscoveryListing {
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    city: l.city,
    province: l.province,
    type: l.type,
    images: l.images,
    max_guests: l.max_guests,
    amenities: l.amenities,
    nightly_php: l.nightly_php,
    avg_rating: l.avg_rating,
    review_count: l.review_count,
    stay_category: l.stay_category ?? null,
    stay_availability_type: l.stay_availability_type ?? null,
    hourly_php: l.hourly_php ?? null,
    price_3h: l.price_3h ?? null,
    price_6h: l.price_6h ?? null,
    price_12h: l.price_12h ?? null,
    promo_price: l.promo_price ?? null,
  };
}
