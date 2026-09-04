// Precision helpers shared by main and renderer.
// Money -> integer stotinki (1 lev = 100 stotinki).
// Quantity -> integer "milli-units" (1 unit = 1000 milli-units), which lets
// кг. quantities keep up to 3 decimal places without any floating point drift.

export const MILLI = 1000;

export function quantityToMilli(qty: number): number {
  if (!Number.isFinite(qty)) throw new Error("invalid_quantity");
  return Math.round(qty * MILLI);
}

export function milliToQuantity(milli: number): number {
  return Math.round(milli) / MILLI;
}

export function levaToCents(leva: number): number {
  if (!Number.isFinite(leva)) throw new Error("invalid_amount");
  return Math.round(leva * 100);
}

export function centsToLeva(cents: number): number {
  return Math.round(cents) / 100;
}

export function centsFromMilliAndUnitPrice(quantityMilli: number, unitPriceCents: number): number {
  // quantity(real) * price(cents) = quantityMilli/1000 * priceCents
  return Math.round((quantityMilli * unitPriceCents) / MILLI);
}

export function formatMoneyBGN(cents: number): string {
  const leva = centsToLeva(cents);
  return `${leva.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} лв.`;
}

export function formatQuantity(milli: number, unit: "kg" | "pcs"): string {
  const qty = milliToQuantity(milli);
  const formatted =
    unit === "pcs"
      ? qty.toLocaleString("bg-BG", { maximumFractionDigits: 0 })
      : qty.toLocaleString("bg-BG", { minimumFractionDigits: unit === "kg" && qty % 1 !== 0 ? 2 : 0, maximumFractionDigits: 3 });
  const unitLabel = unit === "kg" ? "кг." : "бр.";
  return `${formatted} ${unitLabel}`;
}
