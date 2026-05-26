export const DEMO_LISTING_IMAGES: Record<string, string> = {
  "cubao condo": "/demo-listings/05-seed-cubao-condo-bedroom-living.png",
  "cubao deca": "/demo-listings/06-seed-cubao-deca-condo-pool-exterior.png",
  "cozy staycation condo in cubao": "/demo-listings/07-seed-cozy-staycation-condo-cubao-studio.png",
  "surf bungalow near cloud 9": "/demo-listings/08-seed-surf-bungalow-near-cloud9.png",
  "volcano view cabin": "/demo-listings/09-seed-volcano-view-cabin.png",
  "hillside villa above chocolate hills": "/demo-listings/10-seed-hillside-villa-above-chocolate-hills.png",
};

/**
 * Resolves a demo listing image using normalized title/slug matching.
 */
export function getDemoListingImage(listing: { title: string; slug?: string | null }): string | null {
  const title = (listing.title ?? "").toLowerCase().trim();
  const slug = (listing.slug ?? "").toLowerCase().trim();

  // Normalize spaces/dashes
  const cleanTitle = title.replace(/[-\s]+/g, " ");
  const cleanSlug = slug.replace(/[-\s]+/g, " ");

  // Exact or contains match on keys
  for (const [key, path] of Object.entries(DEMO_LISTING_IMAGES)) {
    const cleanKey = key.toLowerCase().trim();
    if (cleanTitle.includes(cleanKey) || cleanSlug.includes(cleanKey)) {
      return path;
    }
  }

  // Handle fuzzy match for cloud 9/cloud9, volcano, etc.
  if (
    cleanTitle.includes("cloud 9") ||
    cleanTitle.includes("cloud9") ||
    cleanSlug.includes("cloud9") ||
    cleanSlug.includes("cloud-9")
  ) {
    return "/demo-listings/08-seed-surf-bungalow-near-cloud9.png";
  }
  if (cleanTitle.includes("volcano") || cleanSlug.includes("volcano")) {
    return "/demo-listings/09-seed-volcano-view-cabin.png";
  }
  if (cleanTitle.includes("chocolate hills") || cleanSlug.includes("chocolate-hills")) {
    return "/demo-listings/10-seed-hillside-villa-above-chocolate-hills.png";
  }

  return null;
}

/**
 * Resolves a category/type fallback from /demo-listings.
 */
export function getListingFallbackImage(listing: { type?: string }): string {
  const type = (listing.type ?? "").toLowerCase();
  if (type === "villa") {
    return "/demo-listings/10-seed-hillside-villa-above-chocolate-hills.png";
  }
  if (type === "glamping") {
    return "/demo-listings/08-seed-surf-bungalow-near-cloud9.png";
  }
  // Default to Cubao condo bedroom living
  return "/demo-listings/05-seed-cubao-condo-bedroom-living.png";
}

/**
 * Resolves primary listing image using the strict priority:
 * 1. Real listing.images image if valid
 * 2. Mapped demo image by normalized title/slug
 * 3. Category/type fallback from /demo-listings
 */
export function getListingPrimaryImage(listing: {
  title: string;
  slug?: string | null;
  images?: string[];
  type?: string;
}): string | null {
  if (listing.images && listing.images.length > 0 && listing.images[0]) {
    return listing.images[0];
  }
  const demoImg = getDemoListingImage(listing);
  if (demoImg) {
    return demoImg;
  }
  return getListingFallbackImage(listing);
}

/**
 * Resolves a descriptive alt text for listing images.
 */
export function getListingImageAlt(listing: { title: string; city?: string; province?: string }): string {
  const parts = [listing.title];
  if (listing.city) parts.push(listing.city);
  if (listing.province) parts.push(listing.province);
  return parts.join(" — ");
}
