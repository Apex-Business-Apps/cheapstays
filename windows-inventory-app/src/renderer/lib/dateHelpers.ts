const MONTH_NAMES_BG = [
  "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември",
];

export function monthLabel(month: number): string {
  return MONTH_NAMES_BG[month - 1] ?? String(month);
}

export function monthOptions(): { value: number; label: string }[] {
  return MONTH_NAMES_BG.map((label, idx) => ({ value: idx + 1, label }));
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
