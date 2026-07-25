import * as React from "react";
import { Calendar, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, disabled, ...props }, ref) => {
    const isPicker = !!type && PICKER_TYPES.has(type);

    // Native date/time inputs on Chromium/Safari only open the picker when the
    // little icon on the right is clicked. Make the entire input area a picker
    // trigger via showPicker(). No-ops on browsers without the API.
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLInputElement>) => {
        onClick?.(e);
        if (!isPicker || e.defaultPrevented || e.currentTarget.disabled) return;
        try { e.currentTarget.showPicker?.(); } catch { /* focus-required errors are ignored */ }
      },
      [onClick, isPicker],
    );

    const input = (
      <input
        type={type}
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isPicker && "cursor-pointer pr-10 native-picker-hidden",
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    if (!isPicker) return input;

    const IconComp = type === "time" ? Clock : Calendar;
    return (
      <div className="relative">
        {input}
        <IconComp
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
            disabled && "opacity-50",
          )}
          aria-hidden="true"
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
