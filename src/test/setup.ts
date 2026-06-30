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
