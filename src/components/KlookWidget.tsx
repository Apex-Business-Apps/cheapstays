import React, { useMemo } from "react";

interface KlookWidgetProps {
  cityId: string;
}

const DEFAULT_KLOOK_CITY_ID = "97";
const KLOOK_WIDGET_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

const getSafeCityId = (cityId: string): string => {
  // Restrict the dynamic widget parameter to Klook's numeric city identifiers.
  return /^\d+$/.test(cityId) ? cityId : DEFAULT_KLOOK_CITY_ID;
};

const buildKlookWidgetUrl = (cityId: string): string => {
  const params = new URLSearchParams({
    currency: "PHP",
    trs: "533438",
    shmarker: "733201",
    locale: "en",
    city_id: getSafeCityId(cityId),
    category: "2",
    amount: "3",
    powered_by: "true",
    campaign_id: "137",
    promo_id: "4497",
  });

  return `https://tpwgts.com/content?${params.toString()}`;
};

const buildKlookWidgetSrcDoc = (widgetUrl: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body { margin: 0; min-height: 100%; background: transparent; }
      body { display: flex; justify-content: center; }
    </style>
  </head>
  <body>
    <script async src=${JSON.stringify(widgetUrl)}></script>
  </body>
</html>`;

export function KlookWidget({ cityId }: KlookWidgetProps) {
  const widgetSrcDoc = useMemo(() => buildKlookWidgetSrcDoc(buildKlookWidgetUrl(cityId)), [cityId]);

  return (
    <iframe
      className="klook-widget-container min-h-[400px] w-full border-0"
      referrerPolicy="no-referrer"
      sandbox={KLOOK_WIDGET_SANDBOX}
      srcDoc={widgetSrcDoc}
      title="Klook tours and activities"
    />
  );
}
