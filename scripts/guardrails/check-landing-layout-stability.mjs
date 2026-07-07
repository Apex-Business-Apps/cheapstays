import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Landing layout stability guardrail (post scroll-snap incident).
//
// Root cause being guarded: `body.snap-landing-active { scroll-snap-type: y mandatory }`
// made the document a snap container. Snap containers disable browser scroll
// anchoring, so when the homepage's async sections (Popular Cities, Featured
// Stays, Quick Stays) resolved and changed height, everything below jumped
// with no compensation — a massive cumulative layout shift. The companion
// `min-height: 100svh` panel rule also stretched short sections into huge
// blank bands. Landing sections must flow naturally.

const failures = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

// src/test mirrors these checks as expectations, so its literals are exempt.
const files = walk('src').filter((f) => !f.startsWith(join('src', 'test')));

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  // Strip comments so documentation of the incident doesn't trip the check.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  if (/scroll-snap-type\s*:\s*(y|both|block)\s+mandatory/.test(code)) {
    failures.push(`${file}: document-axis mandatory scroll snapping is banned on this app (disables scroll anchoring → layout shift)`);
  }
  if (/snap-landing-active/.test(code)) {
    failures.push(`${file}: "snap-landing-active" body-class mechanism must not be reintroduced`);
  }
  if (/classList\.(add|toggle)\(\s*["'`][^"'`]*snap/.test(code)) {
    failures.push(`${file}: adding snap classes to document/body at runtime is banned`);
  }
}

// The parallax atmosphere layers animate transform every frame; if the browser
// selects one as its scroll-anchor node, scroll anchoring is suppressed and
// late-loading content shifts the page. They must stay opted out.
const css = readFileSync('src/index.css', 'utf8');
if (!/\.atmo-bg-layer,\s*\n\s*\.atmo-tint-layer,\s*\n\s*\.atmo-veil-layer\s*\{\s*\n\s*overflow-anchor:\s*none/.test(css)) {
  failures.push('src/index.css: atmo layers must keep "overflow-anchor: none" (scroll-anchoring suppression fix)');
}

// The homepage must keep rendering its four core sections. Guards against a
// refactor (or hallucinated "cleanup") silently dropping them.
const index = readFileSync('src/pages/Index.tsx', 'utf8');
for (const section of ['Hero', 'PopularCitiesSection', 'FeaturedStaysSection', 'QuickStaysSection', 'BecomeHost']) {
  if (!new RegExp(`<${section}\\s*/>`).test(index)) {
    failures.push(`src/pages/Index.tsx: homepage section <${section} /> is missing`);
  }
}

// Async sections must keep loading skeletons that reserve card space, so the
// skeleton → data swap doesn't collapse/expand the section.
for (const [file, skeleton] of [
  ['src/components/homepage/PopularCitiesSection.tsx', 'CityCardSkeleton'],
  ['src/components/homepage/FeaturedStaysSection.tsx', 'StayCardSkeleton'],
  ['src/components/homepage/QuickStaysSection.tsx', 'CardSkeleton'],
]) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(skeleton)) {
    failures.push(`${file}: loading skeleton ${skeleton} removed — async sections must reserve space while loading`);
  }
}

if (failures.length > 0) {
  console.error('Landing layout stability guardrail failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('landing layout stability guardrail passed');
