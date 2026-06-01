import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KlookWidget } from "@/components/KlookWidget";

const KLOOK_WIDGET_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

describe("KlookWidget", () => {
  it("isolates the third-party script in a sandboxed iframe", () => {
    render(<KlookWidget cityId="35" />);

    const iframe = screen.getByTitle("Klook tours and activities") as HTMLIFrameElement;

    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe).toHaveAttribute("sandbox", KLOOK_WIDGET_SANDBOX);
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(document.querySelector('script[src^="https://tpwgts.com/content"]')).toBeNull();
    expect(iframe.srcdoc).toContain("https://tpwgts.com/content?");
    expect(iframe.srcdoc).toContain("city_id=35");
  });

  it("falls back when the city id is not a numeric Klook identifier", () => {
    render(<KlookWidget cityId={'35" onerror="alert(1)'} />);

    const iframe = screen.getByTitle("Klook tours and activities") as HTMLIFrameElement;

    expect(iframe.srcdoc).toContain("city_id=97");
    expect(iframe.srcdoc).not.toContain("onerror");
  });
});
