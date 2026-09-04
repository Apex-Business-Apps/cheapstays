/**
 * User-facing errors. The `message` is always Bulgarian and safe to show
 * directly in the UI. Anything unexpected gets logged with full detail via
 * logger.ts and surfaced to the user as a generic message instead (see
 * CLAUDE guidance §28 in the parent repo — same principle applies here).
 */
export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AppError";
  }
}

export const Errors = {
  insufficientStock: (productName: string) =>
    new AppError(
      "INSUFFICIENT_STOCK",
      `Недостатъчна наличност за „${productName}“. Записът не е запазен.`
    ),
  duplicateProductName: (name: string) =>
    new AppError("DUPLICATE_PRODUCT", `Вече съществува продукт с име „${name}“.`),
  duplicateInvoiceNumber: (num: string) =>
    new AppError(
      "DUPLICATE_INVOICE",
      `Вече има фактура № ${num} от този доставчик.`
    ),
  notFound: (what: string) => new AppError("NOT_FOUND", `${what} не е намерен(а).`),
  validation: (message: string) => new AppError("VALIDATION", message),
  periodClosed: () =>
    new AppError(
      "PERIOD_CLOSED",
      "Този месец е приключен. Редакцията ще промени приключени данни — потвърдете, за да продължите."
    ),
  generic: () =>
    new AppError(
      "INTERNAL",
      "Възникна проблем при записването. Данните не са променени."
    ),
};

export function toApiError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: "INTERNAL", message: Errors.generic().message };
}
