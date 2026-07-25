import * as React from "react";

import { cn } from "@/lib/utils";

const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, ...props }, ref) => {
    const isPicker = type && PICKER_TYPES.has(type);

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

    return (
      <input
        type={type}
        onClick={handleClick}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isPicker && "cursor-pointer",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
