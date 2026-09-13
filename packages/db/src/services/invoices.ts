/**
 * Pure invoice rules — no DB, no IO (PRD §6.1 / §14.8).
 * Legal status transitions, overdue predicate, payment allocation.
 */
import type { InvoiceStatus } from "@logiflow/contracts";

// ── Legal status transitions ────────────────────────────────────────────────

/**
 * Invoice status transition map (PRD §6.1):
 *   pending → paid | overdue
 *   overdue → paid
 *   paid    → (terminal)
 *
 * The `invoice_overdue_sweep` job moves pending → overdue when past dueDate.
 */
const TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  pending: ["paid", "overdue"],
  overdue: ["paid"],
  paid: [],
};

export function isValidTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Cannot move invoice from "${from}" to "${to}".`);
  }
}

// ── Overdue predicate ───────────────────────────────────────────────────────

/** An invoice is overdue when it is not paid and the due date has passed. */
export function isOverdue(status: InvoiceStatus, dueDateMs: number, now = Date.now()): boolean {
  return status !== "paid" && dueDateMs < now;
}

/** Should the overdue sweep flag this invoice? Only pending invoices past due. */
export function shouldFlagOverdue(status: InvoiceStatus, dueDateMs: number, now = Date.now()): boolean {
  return status === "pending" && dueDateMs < now;
}

// ── Payment allocation ──────────────────────────────────────────────────────

/**
 * Payment allocation rules. In v2 the full amount is credited on `paid`;
 * partial payments and splits are left for a future iteration.
 */
export function allocatePayment(
  invoiceTotalPaise: number,
  paidAmountPaise: number,
): { fullyPaid: boolean; appliedPaise: number } {
  return {
    fullyPaid: paidAmountPaise >= invoiceTotalPaise,
    appliedPaise: Math.min(paidAmountPaise, invoiceTotalPaise),
  };
}

// ── Status labels (for audit summaries) ─────────────────────────────────────
export const INVOICE_STATUS_ACTION: Record<InvoiceStatus, string> = {
  pending: "invoice.status_changed",
  overdue: "invoice.overdue_flagged",
  paid: "invoice.status_changed",
};
