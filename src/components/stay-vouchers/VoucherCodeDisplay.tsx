import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function VoucherCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border p-4 flex items-center justify-between gap-4 bg-secondary/30">
      <span className="font-mono text-2xl tracking-widest select-all">{code}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Could not copy. Long-press the code to select it manually.");
          }
        }}
        className="min-h-[44px]"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}
