-- =========================================
-- SEED: 25 Philippine Property Listings
--
-- Uses session_replication_role = replica to bypass FK constraints
-- so we can seed with a synthetic host_id that doesn't exist in auth.users.
-- This is safe for development/staging seeds only.
-- =========================================

SET session_replication_role = replica;

INSERT INTO public.listings
  (host_id, title, slug, description, type, city, province,
   bedrooms, bathrooms, max_guests, nightly_php, min_nights,
   amenities, images, is_owner_direct, instant_book, status)
VALUES

-- ── El Nido, Palawan ──────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Bamboo Villa with Lagoon Views',
  'bamboo-villa-lagoon-views-el-nido',
  'Wake up to turquoise lagoons and towering limestone karsts from this open-air bamboo villa perched above the treeline. Outdoor bath, full kitchen, and unobstructed sunrise views over Bacuit Bay.',
  'villa', 'El Nido', 'Palawan',
  2, 1.0, 4, 4800.00, 2,
  '{wifi,kitchen,outdoor_shower,fan,hammock,kayak}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Beachfront Nipa Cottage',
  'beachfront-nipa-cottage-el-nido',
  'Step directly onto white sand from your private nipa cottage on a secluded cove in El Nido. Solar-powered, with a hammock deck and shared outdoor kitchen.',
  'entire_place', 'El Nido', 'Palawan',
  1, 1.0, 3, 3200.00, 2,
  '{fan,outdoor_shower,hammock,snorkel_gear,beach_access}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Siargao ───────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Surf Bungalow near Cloud 9',
  'surf-bungalow-cloud9-siargao',
  'A five-minute board carry to Cloud 9 break. This hip bungalow has a built-in board rack, outdoor rinse station, and a chill common area with hammocks. Great for solo surfers or pairs.',
  'entire_place', 'General Luna', 'Surigao del Norte',
  1, 1.0, 2, 2950.00, 2,
  '{wifi,fan,outdoor_shower,board_rack,hammock,bike_rental}',
  '[]'::jsonb, true, true, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Coconut Grove Cottage',
  'coconut-grove-cottage-siargao',
  'Hidden among towering coconut palms, this rustic cottage offers peaceful seclusion just 10 minutes from the main surf spots. Ideal for couples wanting an off-grid island feel.',
  'entire_place', 'General Luna', 'Surigao del Norte',
  1, 1.0, 2, 2200.00, 2,
  '{fan,outdoor_shower,hammock,garden,bonfire_pit}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Bohol ─────────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Hillside Villa above Chocolate Hills',
  'hillside-villa-chocolate-hills-bohol',
  'A spacious private villa with floor-to-ceiling windows framing the iconic Chocolate Hills panorama. Private pool, full kitchen, and a dedicated housekeeper available on request.',
  'villa', 'Carmen', 'Bohol',
  3, 2.0, 6, 6200.00, 3,
  '{wifi,aircon,kitchen,private_pool,parking,housekeeper_available,bbq_grill}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Rice Terrace Private Room',
  'rice-terrace-private-room-bohol',
  'A cozy private room inside a working rice farm homestay. Wake up to roosters and mist rolling over terraced paddies. Breakfast of fresh farm produce included.',
  'private_room', 'Batuan', 'Bohol',
  1, 1.0, 2, 1800.00, 1,
  '{fan,breakfast_included,garden,farm_tour}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Batanes ───────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Traditional Ivatan Stone House',
  'ivatan-stone-house-batanes',
  'Sleep inside an authentic centuries-old Ivatan stone house with thick limestone walls that keep the interiors naturally cool even during typhoon season. Walking distance to Valugan Boulder Beach.',
  'entire_place', 'Basco', 'Batanes',
  2, 1.0, 4, 3400.00, 2,
  '{kitchen,fan,garden,parking,cultural_tour}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Vigan, Ilocos Sur ─────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Heritage Casa in Calle Crisologo',
  'heritage-casa-calle-crisologo-vigan',
  'A meticulously restored Spanish colonial casa within the UNESCO World Heritage buffer zone of Vigan. Cobblestone street views, antique furnishings, and a private inner courtyard.',
  'entire_place', 'Vigan', 'Ilocos Sur',
  2, 1.0, 4, 2100.00, 1,
  '{wifi,aircon,kitchen,parking,heritage_tour}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Ancestral House Private Room',
  'ancestral-house-private-room-vigan',
  'Affordable private room inside a living ancestral house occupied by the owner family. Shared kitchen and sala with antique Ilocano furniture. Perfect for solo travelers and history buffs.',
  'private_room', 'Vigan', 'Ilocos Sur',
  1, 1.0, 2, 1400.00, 1,
  '{wifi,fan,kitchen_shared,heritage_tour}',
  '[]'::jsonb, true, true, 'active'
),

-- ── Boracay ───────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Cliffside Cottage with Sea View',
  'cliffside-cottage-sea-view-boracay',
  'Perched on the quieter eastern cliff of Boracay with sweeping Sibuyan Sea views and cool breezes. Private terrace, daily housekeeping, and a 10-minute walk to White Beach.',
  'entire_place', 'Boracay Island', 'Aklan',
  2, 1.0, 4, 5400.00, 2,
  '{wifi,aircon,kitchen,terrace,parking}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Beachfront Studio on White Beach',
  'beachfront-studio-white-beach-boracay',
  'Wake up and walk five steps onto Station 2 of White Beach from this compact but stylish beachfront studio. Air-conditioned with a kitchenette, freshwater shower, and daily linen service.',
  'entire_place', 'Boracay Island', 'Aklan',
  1, 1.0, 2, 4200.00, 2,
  '{wifi,aircon,kitchenette,beach_access,daily_housekeeping}',
  '[]'::jsonb, true, true, 'active'
),

-- ── Baguio ────────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Pine Forest A-Frame Cabin',
  'pine-forest-aframe-cabin-baguio',
  'A handcrafted A-frame nestled in a private pine grove outside Baguio proper. Wood-burning stove, loft sleeping area, full kitchen, and a fire pit for cool mountain evenings.',
  'entire_place', 'Baguio', 'Benguet',
  1, 1.0, 3, 2750.00, 2,
  '{kitchen,fireplace,fire_pit,parking,garden,no_aircon_needed}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Hillside Garden Cabin',
  'hillside-garden-cabin-baguio',
  'A cozy cabin surrounded by a terraced flower garden with views of the Cordillera mountains. Heated with electric blankets, pet-friendly, and close to Burnham Park.',
  'entire_place', 'Baguio', 'Benguet',
  1, 1.0, 2, 1900.00, 1,
  '{wifi,kitchen,garden,pet_friendly,parking,electric_blankets}',
  '[]'::jsonb, true, true, 'active'
),

-- ── Cebu City ─────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Skyline Condo in IT Park',
  'skyline-condo-it-park-cebu',
  'A sleek 32nd-floor condo in Cebu IT Park with panoramic city and sea views. Fully furnished with high-speed fiber internet, ideal for remote workers and business travelers.',
  'entire_place', 'Cebu City', 'Cebu',
  1, 1.0, 2, 2300.00, 1,
  '{wifi,aircon,kitchen,gym,pool,parking,work_desk}',
  '[]'::jsonb, true, true, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'BGC-Style Studio near Ayala',
  'bgc-style-studio-ayala-cebu',
  'A modern studio in a new Cebu development with BGC-inspired interiors. Fast wifi, smart TV, espresso maker, and building amenities including a rooftop pool.',
  'entire_place', 'Cebu City', 'Cebu',
  1, 1.0, 2, 1850.00, 1,
  '{wifi,aircon,kitchenette,rooftop_pool,gym,smart_tv}',
  '[]'::jsonb, true, true, 'active'
),

-- ── Coron, Palawan ────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Overwater Bamboo Bungalow',
  'overwater-bamboo-bungalow-coron',
  'Sleep directly above the crystal-clear waters of Coron Bay in a traditional overwater bamboo bungalow. Ladder access to the water for swimming and a front-row seat to spectacular sunsets.',
  'glamping', 'Coron', 'Palawan',
  1, 1.0, 2, 3900.00, 2,
  '{fan,outdoor_shower,snorkel_gear,kayak,hammock,beach_access}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Lake View Room at Kayangan Ridge',
  'lake-view-room-kayangan-ridge-coron',
  'A private room with a private balcony overlooking the famous Kayangan Lake viewpoint. Shared common areas with other travelers, breakfast of fresh coconut and local bread included.',
  'private_room', 'Coron', 'Palawan',
  1, 1.0, 2, 2800.00, 2,
  '{fan,breakfast_included,kayak,snorkel_gear,lake_view}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Tagaytay ─────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Volcano View Cabin',
  'volcano-view-cabin-tagaytay',
  'A snug cabin with an unobstructed frame of Taal Volcano from every window. Wood interiors, a pellet stove for cool evenings, and a front deck for sunrise coffee with volcano views.',
  'entire_place', 'Tagaytay', 'Cavite',
  1, 1.0, 2, 2600.00, 2,
  '{wifi,kitchen,fireplace,parking,garden,volcano_view}',
  '[]'::jsonb, true, false, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Ridge House with Taal Panorama',
  'ridge-house-taal-panorama-tagaytay',
  'A fully detached ridge house with a 270-degree panoramic terrace looking over Taal Lake and the volcano. Sleeps up to 8, perfect for family getaways or barkada trips.',
  'entire_place', 'Tagaytay', 'Cavite',
  3, 2.0, 8, 3100.00, 2,
  '{wifi,aircon,kitchen,parking,bbq_grill,terrace,volcano_view}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Iloilo City ───────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Restored Heritage House in Jaro',
  'restored-heritage-house-jaro-iloilo',
  'A lovingly restored art deco heritage house in the Jaro district, walking distance to the Jaro Cathedral. High ceilings, vintage tile floors, and a shaded inner garden.',
  'entire_place', 'Iloilo City', 'Iloilo',
  2, 1.0, 4, 2200.00, 1,
  '{wifi,aircon,kitchen,garden,parking,heritage_tour}',
  '[]'::jsonb, true, false, 'active'
),

-- ── Dumaguete ─────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Coastal Apartment near Boulevard',
  'coastal-apartment-boulevard-dumaguete',
  'A bright 2-bedroom apartment one block from the famous Rizal Boulevard seafront promenade. Ideal base for diving Apo Island. Secure parking and high-speed internet.',
  'entire_place', 'Dumaguete', 'Negros Oriental',
  2, 1.0, 4, 2450.00, 1,
  '{wifi,aircon,kitchen,parking,dive_equipment_storage}',
  '[]'::jsonb, true, true, 'active'
),

-- ── Camiguin ─────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Black Sand Cove Cottage',
  'black-sand-cove-cottage-camiguin',
  'A romantic cottage on Camiguin''s black volcanic sand beach facing the sunken cemetery marker. Fresh spring-water pool, outdoor dining area, and a kayak for exploring the cove.',
  'entire_place', 'Mambajao', 'Camiguin',
  1, 1.0, 2, 3200.00, 2,
  '{fan,outdoor_shower,spring_pool,kayak,hammock,beach_access}',
  '[]'::jsonb, true, false, 'active'
),

-- ── La Union ──────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Surf Shack on San Juan Beach',
  'surf-shack-san-juan-beach-la-union',
  'A laid-back surf shack right on San Juan''s main break. Board racks, outdoor rinsing station, a common hangout deck, and a 2-minute walk to the best surf school clusters on the north coast.',
  'entire_place', 'San Juan', 'La Union',
  1, 1.0, 2, 2700.00, 1,
  '{wifi,fan,outdoor_shower,board_rack,surf_lessons_nearby,hammock}',
  '[]'::jsonb, true, true, 'active'
),

-- ── Davao City ────────────────────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'City Flat near SM Lanang',
  'city-flat-sm-lanang-davao',
  'A modern one-bedroom flat in a secure mid-rise near SM Lanang Premier. Fast fiber internet, smart TV, and complete cooking facilities. Great for business travelers and Mindanao explorers.',
  'entire_place', 'Davao City', 'Davao del Sur',
  1, 1.0, 2, 2900.00, 1,
  '{wifi,aircon,kitchen,parking,smart_tv,work_desk}',
  '[]'::jsonb, true, true, 'active'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Garden Suite with Mt. Apo View',
  'garden-suite-mt-apo-view-davao',
  'A private garden suite on an organic farm property on the outskirts of Davao with clear views of Mt. Apo on fair days. Farm-to-table breakfast basket included. Perfect for nature lovers.',
  'entire_place', 'Davao City', 'Davao del Sur',
  1, 1.0, 2, 2100.00, 2,
  '{fan,breakfast_included,garden,farm_tour,parking,mt_apo_view}',
  '[]'::jsonb, true, false, 'active'
);

SET session_replication_role = DEFAULT;
