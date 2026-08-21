import "@testing-library/jest-dom";

// jsdom doesn't always expose a functional Storage, but supabase-js reads the
// auth session from localStorage on client init. Without a real getItem/setItem
// the async session load throws "storage.getItem is not a function" as an
// unhandled rejection and fails otherwise-passing suites. Provide a minimal
// in-memory implementation before any module captures `localStorage`.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}
const memoryStorage = new MemoryStorage();
Object.defineProperty(window, "localStorage", { configurable: true, writable: true, value: memoryStorage });
Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: memoryStorage });

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

(globalThis as { __CACHE_BUST__?: string }).__CACHE_BUST__ = 'test';

// Radix UI components (RadioGroup, Checkbox, etc.) rely on ResizeObserver,
// which jsdom does not implement. Provide a no-op stub so component renders
// don't throw during unit tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Embla carousel uses IntersectionObserver to detect slides in view; jsdom
// doesn't implement it. A no-op stub is enough — tests care about which
// controls render, not visibility tracking.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
}
