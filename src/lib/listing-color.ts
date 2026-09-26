export type ListingColor = {
  bar: string;
  barText: string;
  dot: string;
  softBg: string;
  softText: string;
};

const PALETTE: ListingColor[] = [
  { bar: "bg-sky-500",     barText: "text-white", dot: "bg-sky-500",     softBg: "bg-sky-100 dark:bg-sky-900/40",         softText: "text-sky-900 dark:text-sky-100" },
  { bar: "bg-emerald-500", barText: "text-white", dot: "bg-emerald-500", softBg: "bg-emerald-100 dark:bg-emerald-900/40", softText: "text-emerald-900 dark:text-emerald-100" },
  { bar: "bg-violet-500",  barText: "text-white", dot: "bg-violet-500",  softBg: "bg-violet-100 dark:bg-violet-900/40",   softText: "text-violet-900 dark:text-violet-100" },
  { bar: "bg-amber-500",   barText: "text-white", dot: "bg-amber-500",   softBg: "bg-amber-100 dark:bg-amber-900/40",     softText: "text-amber-900 dark:text-amber-100" },
  { bar: "bg-rose-500",    barText: "text-white", dot: "bg-rose-500",    softBg: "bg-rose-100 dark:bg-rose-900/40",       softText: "text-rose-900 dark:text-rose-100" },
  { bar: "bg-teal-500",    barText: "text-white", dot: "bg-teal-500",    softBg: "bg-teal-100 dark:bg-teal-900/40",       softText: "text-teal-900 dark:text-teal-100" },
  { bar: "bg-fuchsia-500", barText: "text-white", dot: "bg-fuchsia-500", softBg: "bg-fuchsia-100 dark:bg-fuchsia-900/40", softText: "text-fuchsia-900 dark:text-fuchsia-100" },
  { bar: "bg-indigo-500",  barText: "text-white", dot: "bg-indigo-500",  softBg: "bg-indigo-100 dark:bg-indigo-900/40",   softText: "text-indigo-900 dark:text-indigo-100" },
];

export function listingColor(listingId: string): ListingColor {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < listingId.length; i++) {
    h ^= listingId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
