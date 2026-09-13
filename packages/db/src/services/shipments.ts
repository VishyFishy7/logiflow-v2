/**
 * Pure shipment business rules — no SQL, no ORM.
 *
 * These functions are the single source of truth for transition logic,
 * field requirements, derived flags, transit-day tables, and checkpoint
 * label/location rules. Both the repository and the background worker
 * call these so a rule can never disagree between the two.
 */
import {
  SERVICE_LEVEL_TRANSIT_DAYS,
  SHIPMENT_STATUS_ORDER,
  type ServiceLevel,
  type ShipmentStatus,
} from "@logiflow/contracts";
import type { ShipmentDTO } from "@logiflow/contracts";
import { ApiError } from "../errors";

// ── Re-export the transit-day table so callers get it from one place ────────

export { SERVICE_LEVEL_TRANSIT_DAYS };

// ── Allowed status transitions (PRD §6.1 / §8.4) ─────────────────────────

/**
 * On-path chain: pickup → warehouse → in_transit → delivered.
 * `delayed` is reachable from any non-delivered status and can recover
 * to any on-path status. Backward moves are correction (ops fixing a mis-tap).
 * `delivered` is terminal — nothing follows.
 */
const CHAIN = SHIPMENT_STATUS_ORDER as readonly ShipmentStatus[];

/**
 * Assert that a status transition is valid.
 *
 * Rules (PRD §6.1):
 *  1. `delivered` is terminal — no transition out.
 *  2. `delayed` requires a `delayReason`.
 *  3. `delayed` can become any on-path status (recovery).
 *  4. Any on-path status can become `delayed`.
 *  5. Forward moves must be exactly one step (no skipping).
 *  6. Backward moves (corrections) are always allowed.
 *
 * @throws ApiError INVALID_STATUS_TRANSITION | DELAY_REASON_REQUIRED
 */
export function assertTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
  delayReason?: string | null,
): void {
  if (from === "delivered") {
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      "A delivered shipment cannot move again.",
    );
  }

  if (from === to) return; // no-op is fine

  if (to === "delayed") {
    if (!delayReason) {
      throw new ApiError(
        "DELAY_REASON_REQUIRED",
        "A delay needs a reason.",
      );
    }
    return; // any non-delivered → delayed is always valid
  }

  if (from === "delayed") {
    // recovery: delayed → any on-path status
    if (CHAIN.includes(to)) return;
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      `Cannot move from Delayed to ${to}.`,
    );
  }

  const fromIndex = CHAIN.indexOf(from);
  const toIndex = CHAIN.indexOf(to);

  if (fromIndex < 0 || toIndex < 0) {
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      `Unknown status "${to}".`,
    );
  }

  // Backward moves are correction — always allowed.
  if (toIndex < fromIndex) return;

  // Forward: must be exactly one step.
  if (toIndex === fromIndex + 1) return;

  throw new ApiError(
    "INVALID_STATUS_TRANSITION",
    `Cannot jump from ${from} to ${to}.`,
  );
}

// ── Derived flags ──────────────────────────────────────────────────────────

/** A shipment is overdue when it hasn't been delivered and its ETA has passed. */
export function isOverdue(
  shipment: Pick<ShipmentDTO, "status" | "expectedDelivery">,
  now = Date.now(),
): boolean {
  return shipment.status !== "delivered" && shipment.expectedDelivery < now;
}

/**
 * Needs-attention predicate for the desk "Needs attention" list
 * (PRD §14.2). A shipment needs attention when it's delayed or overdue.
 */
export function needsAttention(
  shipment: Pick<ShipmentDTO, "status" | "expectedDelivery" | "delayReason">,
  now = Date.now(),
): boolean {
  if (shipment.status === "delayed") return true;
  return isOverdue(shipment, now);
}

// ── Checkpoint label rules ─────────────────────────────────────────────────

/**
 * Auto-generate a human-readable checkpoint label from the target status.
 * The caller may override with `input.label`.
 */
export function checkpointLabelForStatus(status: ShipmentStatus): string {
  switch (status) {
    case "pickup":
      return "Picked up";
    case "warehouse":
      return "Received at warehouse";
    case "in_transit":
      return "In transit";
    case "delivered":
      return "Delivered";
    case "delayed":
      return "Delayed";
  }
}

/**
 * Derive a location string for a checkpoint based on status and route.
 * If the caller provides `input.location`, that wins.
 */
export function checkpointLocationForStatus(
  status: ShipmentStatus,
  origin: string,
  destination: string,
  provided?: string | null,
): string | undefined {
  if (provided) return provided;
  switch (status) {
    case "pickup":
      return origin;
    case "warehouse":
      return origin;
    case "in_transit":
      return undefined; // en-route, no fixed location
    case "delivered":
      return destination;
    case "delayed":
      return undefined; // caller should provide
  }
}
