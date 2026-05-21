import { createClient } from "npm:@supabase/supabase-js@2";
import { writeFileSync } from "node:fs";

const supabase = createClient(
  Deno.env.get("VITE_SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_ANON_KEY")!
);

const BASE_URL = "https://cheapstays.me";

const staticRoutes = ["/", "/search", "/auth", "/membership", "/support"];

const { data: listings } = await supabase
  .from("listings")
  .select("id, slug, updated_at")
  .eq("status", "active");

const listingUrls = (listings ?? []).map((l) => {
  const path = l.slug ? `/listing/slug/${l.slug}` : `/listing/${l.id}`;
  return `  <url>\n    <loc>${BASE_URL}${path}</loc>\n    <lastmod>${(l.updated_at ?? new Date().toISOString()).slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`;
});

const staticUrls = staticRoutes.map((r) =>
  `  <url>\n    <loc>${BASE_URL}${r}</loc>\n    <changefreq>daily</changefreq>\n  </url>`
);

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...listingUrls].join("\n")}\n</urlset>`;

writeFileSync("public/sitemap.xml", xml);
console.log(`Sitemap generated: ${staticUrls.length + listingUrls.length} URLs`);
