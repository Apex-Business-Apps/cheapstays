# SEO & Sitemap

## Sitemap Generation

`supabase/scripts/generate-sitemap.ts` is a Deno script that queries Supabase for active listings and writes `public/sitemap.xml` at build time.

Run via:
```
npm run generate:sitemap
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars.

Static routes included: `/`, `/search`, `/auth`, `/membership`, `/support`.

Listing URLs use slug-based paths (`/listing/slug/<slug>`) when a slug is present, falling back to ID-based paths (`/listing/<id>`).

## robots.txt

`public/robots.txt` allows all crawlers and references the sitemap:
```
User-agent: *
Allow: /
Sitemap: https://cheapstays.me/sitemap.xml
```

## JSON-LD Structured Data

`index.html` includes static Organization and WebSite JSON-LD schemas.

`src/components/Seo.tsx` accepts an optional `jsonLd` prop. When provided, it dynamically injects a `<script type="application/ld+json">` tag into `<head>` and cleans it up on unmount or prop change. Use this on listing pages to inject LodgingBusiness or Product schemas.

Example usage:
```tsx
<Seo
  title="Beachfront Nipa Hut — Siargao"
  description="..."
  path="/listing/slug/beachfront-nipa-hut-siargao"
  jsonLd={{
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": "Beachfront Nipa Hut",
    "address": { "@type": "PostalAddress", "addressLocality": "Siargao", "addressCountry": "PH" }
  }}
/>
```

## SSR Decision

CheapStays is a client-side SPA (Vite + React). Meta tags are managed client-side via `Seo.tsx`. The sitemap + robots.txt ensure crawler discoverability.

**SSR migration path**: If server-side rendering is needed (e.g., for social card previews), migrate to a framework like Remix or Next.js, or add a prerender step (e.g., `vite-plugin-ssr`). The `Seo.tsx` API is intentionally compatible with a future SSR rewrite.
