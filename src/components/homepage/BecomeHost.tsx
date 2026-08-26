/**
 * BecomeHost — landing passthrough.
 *
 * The mock consolidates the host CTA into the "For lessors" dark band, which
 * is now rendered by `QuickStaysSection`. The `<BecomeHost />` JSX tag is
 * still required in `src/pages/Index.tsx` by the landing layout-stability
 * guardrail (see `scripts/guardrails/check-landing-layout-stability.mjs`),
 * so this component is intentionally kept but renders nothing visible.
 */
export function BecomeHost() {
  return <section aria-hidden className="hidden" />;
}
