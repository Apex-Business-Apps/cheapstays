import React, { useEffect, useRef } from "react";

interface KlookWidgetProps {
  cityId: string;
}

export function KlookWidget({ cityId }: KlookWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget if any to prevent duplicate injections
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = `https://tpwgts.com/content?currency=PHP&trs=533438&shmarker=733201&locale=en&city_id=${cityId}&category=2&amount=3&powered_by=true&campaign_id=137&promo_id=4497`;
    script.async = true;

    containerRef.current.appendChild(script);

    const currentContainer = containerRef.current;

    return () => {
      // Cleanup to clear container
      if (currentContainer) {
        currentContainer.innerHTML = "";
      }
    };
  }, [cityId]);

  return <div ref={containerRef} className="klook-widget-container w-full" />;
}
