/**
 * Thin wrapper around sonner so all existing callers that use
 * { title, description, variant } keep working without changes.
 *
 * Sonner API: toast(message, options) | toast.error() | toast.success()
 * We map `variant: "destructive"` → toast.error(), everything else → toast()
 */
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

function toast({ title, description, variant }: ToastOptions) {
  const message = title ?? "";
  if (variant === "destructive") {
    sonnerToast.error(message, description ? { description } : undefined);
  } else {
    sonnerToast(message, description ? { description } : undefined);
  }
}

function useToast() {
  return { toast };
}

export { useToast, toast };
