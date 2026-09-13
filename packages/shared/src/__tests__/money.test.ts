/**
 * Money tests — PRD §4.2, §12.7.
 *
 * Integer paise only, Indian digit grouping, compact formatting,
 * taxOn rounding, computeInvoiceTotals consistency, GST 18%, no float drift.
 */
import { describe, it, expect } from "vitest";
import {
  PAISE_PER_RUPEE,
  rupeesToPaise,
  paiseToRupees,
  formatMoney,
  formatMoneyPlain,
  formatMoneyCompact,
  taxOn,
  computeInvoiceTotals,
} from "../money";

// ── Conversions ─────────────────────────────────────────────────────────────
describe("rupeesToPaise / paiseToRupees", () => {
  it("round-trips correctly", () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(paiseToRupees(10000)).toBe(100);
  });

  it("rounds to nearest paisa on fractional rupees", () => {
    expect(rupeesToPaise(10.999)).toBe(1100);
  });

  it("handles zero", () => {
    expect(rupeesToPaise(0)).toBe(0);
  });
});

// ── formatMoney — Indian digit grouping ─────────────────────────────────────
describe("formatMoney", () => {
  it("formats with ₹ symbol and Indian grouping", () => {
    // 12450000 paise = ₹1,24,500.00
    expect(formatMoney(12450000)).toBe("₹1,24,500.00");
  });

  it("formats small amounts", () => {
    expect(formatMoney(500)).toBe("₹5.00");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("₹0.00");
  });

  it("USD format", () => {
    expect(formatMoney(1000000, "USD")).toBe("$10,000.00");
  });
});

// ── formatMoneyCompact — lakh/crore ─────────────────────────────────────────
describe("formatMoneyCompact", () => {
  it("1 Cr → ₹1 Cr (100,000,000 paise = ₹10,00,000 = 10L; 1,000,000,000 paise = ₹1,00,00,000 = 1Cr)", () => {
    expect(formatMoneyCompact(1_000_000_000)).toBe("₹1 Cr"); // ₹1,00,00,000 = 1 crore
    expect(formatMoneyCompact(2_500_000_000)).toBe("₹2.5 Cr"); // ₹2,50,00,000 = 2.5 crore
  });

  it("above 1L → L", () => {
    expect(formatMoneyCompact(1_00_000_00)).toBe("₹1 L"); // ₹1,00,000 = 1 lakh
    expect(formatMoneyCompact(4_50_000_00)).toBe("₹4.5 L"); // ₹4,50,000 = 4.5 lakh
    expect(formatMoneyCompact(100_000_000)).toBe("₹10 L"); // ₹10,00,000 = 10 lakh
  });

  it("above 1K → formatted number with Indian grouping", () => {
    expect(formatMoneyCompact(500000)).toBe("₹5,000"); // ₹5,000
  });

  it("below 1K → plain (no comma grouping)", () => {
    expect(formatMoneyCompact(50000)).toBe("₹500"); // ₹500
  });

  it("very small → ₹5 for 500 paise", () => {
    expect(formatMoneyCompact(500)).toBe("₹5");
  });
});

// ── taxOn — rounding to nearest paisa ───────────────────────────────────────
describe("taxOn", () => {
  it("18% GST (1800 bp) on ₹100 = ₹18", () => {
    expect(taxOn(10000, 1800)).toBe(1800); // 10000 paise * 1800 / 10000 = 1800 paise = ₹18
  });

  it("rounds to nearest paisa, not floor", () => {
    // 3333 paise * 1800 bp / 10000 = 599.94 → 600
    expect(taxOn(3333, 1800)).toBe(600);
  });

  it("handles zero", () => {
    expect(taxOn(0, 1800)).toBe(0);
  });
});

// ── computeInvoiceTotals ────────────────────────────────────────────────────
describe("computeInvoiceTotals", () => {
  it("sums lines correctly for GST 18%", () => {
    const lines = [
      { amountPaise: 100000, taxRateBp: 1800 }, // ₹1000 → tax 18000 paise = ₹180
      { amountPaise: 200000, taxRateBp: 1800 }, // ₹2000 → tax 36000 paise = ₹360
    ];
    const totals = computeInvoiceTotals(lines);
    expect(totals.subtotalPaise).toBe(300000); // ₹3000
    expect(totals.taxPaise).toBe(54000); // ₹540
    expect(totals.totalPaise).toBe(354000); // ₹3540
  });

  it("empty lines → zero totals", () => {
    const totals = computeInvoiceTotals([]);
    expect(totals).toEqual({ subtotalPaise: 0, taxPaise: 0, totalPaise: 0 });
  });

  it("total equals subtotal + tax", () => {
    const lines = [{ amountPaise: 500000, taxRateBp: 1800 }];
    const totals = computeInvoiceTotals(lines);
    expect(totals.totalPaise).toBe(totals.subtotalPaise + totals.taxPaise);
  });
});

// ── No float drift — 1000 random amounts ────────────────────────────────────
describe("no float drift", () => {
  it("taxOn is always an integer for 1000 random amounts", () => {
    let a = 12345;
    for (let i = 0; i < 1000; i++) {
      a = ((a * 16807) % 2147483647) % 10_000_000 + 1;
      const result = taxOn(a, 1800);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it("computeInvoiceTotals always produces integer paise", () => {
    let a = 67890;
    const lines: Array<{ amountPaise: number; taxRateBp: number }> = [];
    for (let i = 0; i < 20; i++) {
      a = ((a * 48271) % 2147483647) % 1_000_000 + 100;
      lines.push({ amountPaise: a, taxRateBp: 1800 });
    }
    const totals = computeInvoiceTotals(lines);
    expect(Number.isInteger(totals.subtotalPaise)).toBe(true);
    expect(Number.isInteger(totals.taxPaise)).toBe(true);
    expect(Number.isInteger(totals.totalPaise)).toBe(true);
    expect(totals.totalPaise).toBe(totals.subtotalPaise + totals.taxPaise);
  });
});
