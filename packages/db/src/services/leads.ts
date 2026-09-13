/**
 * Leads — pure business rules, no SQL.
 * Terminal status set, nextFollowUp computation, lead→client mapping.
 */
import type { LeadStatus, LeadCreateInput } from "@logiflow/contracts";
import { addDays } from "@logiflow/shared";

/** Lead statuses that are terminal — no further status changes allowed. */
export const TERMINAL_LEAD_STATUSES: readonly LeadStatus[] = ["won", "lost"] as const;

/** Is this lead status terminal? */
export function isTerminalLeadStatus(status: LeadStatus): boolean {
  return (TERMINAL_LEAD_STATUSES as readonly LeadStatus[]).includes(status);
}

/**
 * Compute nextFollowUp automatically based on the lead's current status.
 * Returns null for terminal statuses (no follow-up needed).
 */
export function computeNextFollowUp(
  currentStatus: LeadStatus,
  now: number = Date.now(),
): number | null {
  if (isTerminalLeadStatus(currentStatus)) return null;
  switch (currentStatus) {
    case "new":
      return addDays(now, 3); // 3 days
    case "contacted":
      return addDays(now, 7); // 1 week
    case "negotiation":
      return addDays(now, 14); // 2 weeks
    default:
      return null;
  }
}

/**
 * Map lead fields → client fields for conversion (PRD §14.7).
 * The lead's company becomes the client name; the lead's person name
 * becomes the contact name; conversion input overrides where provided.
 */
export function leadToClientMapping(
  lead: { name: string; company: string; email?: string | null; phone?: string | null },
  conversionInput: {
    contactName?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    pincode?: string;
  },
): {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  pincode?: string;
} {
  return {
    name: lead.company,
    contactName: conversionInput.contactName ?? lead.name,
    email: conversionInput.email ?? lead.email ?? undefined,
    phone: conversionInput.phone ?? lead.phone ?? undefined,
    city: conversionInput.city ?? undefined,
    state: conversionInput.state ?? undefined,
    pincode: conversionInput.pincode ?? undefined,
  };
}
