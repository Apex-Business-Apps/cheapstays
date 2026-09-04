import type { InventoryApi } from "../../main/preload";

declare global {
  interface Window {
    api: InventoryApi;
  }
}

export const api = window.api;

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Възникна неочаквана грешка.";
}
