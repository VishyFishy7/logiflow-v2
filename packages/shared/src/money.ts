/**
 * Money. Integer paise everywhere (PRD §4.2) — no floats, ever.
 * Display uses Indian digit grouping (₹1,24,500.00) and a compact form for
 * aggregates above a lakh (PRD §12.7).
 */

export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrNumberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `12450000` paise → `"₹1,24,500.00"`. */
export function formatMoney(paise: number, currency: "INR" | "USD" = "INR"): string {
  const value = paiseToRupees(paise);
  if (currency === "USD") return usdFormatter.format(value);
  return inrFormatter.format(value);
}

export function formatMoneyPlain(paise: number): string {
  return inrNumberFormatter.format(paiseToRupees(paise));
}

/** Lakh/crore grouping for aggregates: `₹1.25 Cr`, `₹4.5 L`, `₹9,400`. */
export function formatMoneyCompact(paise: number): string {
  const rupees = paiseToRupees(paise);
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);
  if (abs >= 1_00_00_000) {
    return `${sign}₹${trimZero(abs / 1_00_00_000)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${trimZero(abs / 1_00_000)} L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)}`;
  }
  return `${sign}₹${trimZero(abs)}`;
}

function trimZero(value: number): string {
  const fixed = value.toFixed(value >= 100 ? 0 : 2);
  // Only strip trailing zeros after a decimal point — never from integers.
  if (fixed.includes(".")) {
    return fixed.replace(/0+$/, "").replace(/\.$/, "");
  }
  return fixed;
}

/** Basis points → tax on a paise amount, rounded to the nearest paisa. */
export function taxOn(amountPaise: number, taxRateBp: number): number {
  return Math.round((amountPaise * taxRateBp) / 10_000);
}

export interface InvoiceTotals {
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
}

export function computeInvoiceTotals(
  lines: readonly { amountPaise: number; taxRateBp: number }[],
): InvoiceTotals {
  const subtotalPaise = lines.reduce((sum, line) => sum + line.amountPaise, 0);
  const taxPaise = lines.reduce(
    (sum, line) => sum + taxOn(line.amountPaise, line.taxRateBp),
    0,
  );
  return { subtotalPaise, taxPaise, totalPaise: subtotalPaise + taxPaise };
}

/** Weight is stored as integer grams; operators think in kilograms. */
export function formatWeight(grams: number): string {
  const kg = grams / 1000;
  return `${kg.toFixed(kg >= 100 ? 0 : 1)} kg`;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}
