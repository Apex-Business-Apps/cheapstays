import { type ReactNode, type UIEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createLegalAcceptanceAudit, getLegalFastAcceptEligibility } from "@/lib/legal-consent";

type LegalScrollGateProps = {
  userId: string;
  role: string;
  contextId: string;
  documentId: string;
  documentVersion: string;
  documentHash: string;
  checkboxLabel: string;
  changedTopics?: string[];
  legalContent: ReactNode;
  onAccepted: () => Promise<void> | void;
};

export function LegalScrollGate(props: LegalScrollGateProps) {
  const [gateOpenedAt] = useState(() => new Date().toISOString());
  const [scrollCompletedAt, setScrollCompletedAt] = useState<string | null>(null);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canFastAccept, setCanFastAccept] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  const requiresBottomScroll = useMemo(() => !canFastAccept, [canFastAccept]);

  // When the legal content is short enough that the viewport isn't scrollable,
  // there's nothing to scroll to, so treat it as already read to the bottom.
  useLayoutEffect(() => {
    if (hasReachedBottom) return;
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;

    const checkScrollable = () => {
      if (viewport.scrollHeight <= viewport.clientHeight + 8) {
        setHasReachedBottom(true);
        setScrollCompletedAt((prev) => prev ?? new Date().toISOString());
        return true;
      }
      return false;
    };

    if (checkScrollable()) return;

    const observer = new ResizeObserver(() => {
      if (checkScrollable()) observer.disconnect();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hasReachedBottom, isLoading, props.legalContent]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const eligibility = await getLegalFastAcceptEligibility({
          userId: props.userId,
          role: props.role,
          contextId: props.contextId,
          documentId: props.documentId,
          documentVersion: props.documentVersion,
          documentHash: props.documentHash,
          changedTopics: props.changedTopics,
        });
        if (!active) return;
        const fast = eligibility.eligible && !eligibility.requires_full_scroll;
        setCanFastAccept(fast);
        if (fast) {
          const now = new Date().toISOString();
          setHasReachedBottom(true); // fast acceptance eligibility bypasses first-time scroll requirement only when backend approved.
          setScrollCompletedAt(now);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [props]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (hasReachedBottom) return;
    const node = event.currentTarget;
    const reachedBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 8;
    if (reachedBottom) {
      setHasReachedBottom(true);
      setScrollCompletedAt(new Date().toISOString());
    }
  };

  const disabled = isLoading || isSubmitting || !isChecked || (requiresBottomScroll && !hasReachedBottom);

  const submit = async () => {
    if (disabled) return;
    setIsSubmitting(true);
    try {
      await createLegalAcceptanceAudit({
        userId: props.userId,
        role: props.role,
        contextId: props.contextId,
        documentId: props.documentId,
        documentVersion: props.documentVersion,
        documentHash: props.documentHash,
        checkboxLabel: props.checkboxLabel,
        scrolledToBottom: hasReachedBottom,
        gateOpenedAt,
        scrollCompletedAt,
      });
      await props.onAccepted();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ScrollArea ref={scrollRootRef} className="h-72 rounded-md border p-4" onScrollCapture={onScroll}>
        {props.legalContent}
      </ScrollArea>
      <div className="flex items-center gap-2">
        <Checkbox id="legal-consent" checked={isChecked} onCheckedChange={(v) => setIsChecked(Boolean(v))} disabled={!hasReachedBottom || isLoading} />
        <label htmlFor="legal-consent" className="text-sm text-muted-foreground">{props.checkboxLabel}</label>
      </div>
      <Button type="button" onClick={submit} disabled={disabled}>
        {isSubmitting ? "Submitting..." : "Continue"}
      </Button>
    </div>
  );
}
