/**
 * Public tracking service (PRD §8.5).
 *
 * `lookupPublicTracking` — the login-free lookup endpoint. Finds a shipment
 * by our tracking ID (normalised first), refuses when the tenant has
 * `publicTrackingEnabled = false`, and returns a `PublicTrackingResponse`
 * with carrier IDs masked and the tenant brand block filled.
 *
 * `revealTrackingIds` — the `POST /:id/tracking/reveal` endpoint.
 * Requires the `tracking:reveal` permission; every call writes an audit row.
 */
import { normaliseTrackingId } from "@logiflow/shared";
import type { PublicTrackingResponse } from "@logiflow/contracts";
import { db } from "../client.js";
import { ApiError } from "../errors.js";
import { recordAudit } from "../audit.js";
import { and, eq, isNull } from "drizzle-orm";
import { shipments, checkpoints, tenants, carriers } from "../schema/index.js";
import { internalIdEnvelope, carrierIdEnvelope } from "../mapping.js";
import type { Actor } from "../actor.js";
import type { MaskedValueDTO } from "@logiflow/contracts";

/** §8.3 reveal response shape (matches zTrackingRevealResponse). */
interface TrackingRevealResponse {
  shipmentId: string;
  trackingId: MaskedValueDTO;
  carrierTrackingId: MaskedValueDTO;
  /** Seconds the client may keep the raw value before re-masking. */
  revealSeconds: number;
}

// ── Brand resolver ─────────────────────────────────────────────────────────

export interface BrandBlock {
  companyName: string;
  productName: string;
  supportEmail: string;
  trackingPrefix: string;
}

export type BrandResolver = (tenantId: string) => BrandBlock | null;

// ── Public lookup ──────────────────────────────────────────────────────────

/**
 * §8.5 — find a shipment by our tracking ID and return the public response.
 *
 * - Normalises the input tracking ID.
 * - Looks up the shipment by `trackingId` + tenant (joined).
 * - Refuses when `publicTrackingEnabled = false` on the tenant.
 * - Returns `PublicTrackingResponse` with carrier IDs MASKED (never reveal
 *   on the public path).
 *
 * @throws ApiError FORBIDDEN when public tracking is disabled
 * @throws ApiError SHIPMENT_NOT_FOUND when no match
 */
export function lookupPublicTracking(
  trackingIdInput: string,
  brandResolver: BrandResolver,
): PublicTrackingResponse {
  const normalised = normaliseTrackingId(trackingIdInput);

  // We need the tenant to check publicTrackingEnabled and build the brand.
  // The tracking prefix is embedded in the ID (e.g. "5LX-ABCD12").
  // Query shipments by tracking_id and join to tenants.
  const [row] = db
    .select({
      shipment: shipments,
      tenant: tenants,
      carrierName: carriers.name,
    })
    .from(shipments)
    .innerJoin(tenants, eq(tenants.id, shipments.tenantId))
    .leftJoin(carriers, eq(carriers.id, shipments.carrierId))
    .where(
      and(
        eq(shipments.trackingId, normalised),
        isNull(shipments.deletedAt),
      ),
    )
    .limit(1)
    .all();

  if (!row) {
    throw new ApiError(
      "SHIPMENT_NOT_FOUND",
      "We couldn't find that consignment.",
    );
  }

  if (!row.tenant.publicTrackingEnabled) {
    throw new ApiError(
      "FORBIDDEN",
      "Public tracking is not enabled for this account.",
    );
  }

  // Build checkpoints (ordered oldest→newest for the timeline display)
  const cpRows = db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.shipmentId, row.shipment.id))
    .orderBy(checkpoints.occurredAt)
    .all();

  const brand = brandResolver(row.tenant.id) ?? {
    companyName: row.tenant.companyName,
    productName: row.tenant.productName,
    supportEmail: row.tenant.supportEmail,
    trackingPrefix: row.tenant.trackingPrefix,
  };

  // Carrier ID is ALWAYS masked on the public path (PRD §8.3 rule 6)
  const maskedCarrierId = carrierIdEnvelope(
    row.shipment.carrierTrackingId,
    false,
  );

  return {
    trackingId: row.shipment.trackingId,
    carrierTrackingId: maskedCarrierId,
    carrierName: row.carrierName ?? "Unknown carrier",
    status: row.shipment.status as PublicTrackingResponse["status"],
    serviceLevel:
      row.shipment.serviceLevel as PublicTrackingResponse["serviceLevel"],
    route: {
      origin: row.shipment.origin,
      destination: row.shipment.destination,
    },
    packages: row.shipment.packages,
    weightGrams: row.shipment.weightGrams,
    expectedDelivery: row.shipment.expectedDelivery,
    deliveredAt: row.shipment.deliveredAt ?? undefined,
    delayReason: row.shipment.delayReason ?? undefined,
    lastUpdatedAt: row.shipment.updatedAt,
    brand,
    checkpoints: cpRows.map((cp) => ({
      status:
        cp.status as PublicTrackingResponse["checkpoints"][number]["status"],
      label: cp.label,
      location: cp.location ?? undefined,
      occurredAt: cp.occurredAt,
    })),
  };
}

// ── Reveal (§8.3) ─────────────────────────────────────────────────────────

/**
 * §8.3 — reveal raw tracking IDs for an internal operator.
 *
 * Requires the `tracking:reveal` permission. Every call writes an audit row.
 * Returns the raw values plus a `revealSeconds` hint for the client's
 * in-memory re-masking timer.
 */
export function revealTrackingIds(
  actor: Actor,
  shipmentId: string,
): TrackingRevealResponse {
  const [row] = db
    .select()
    .from(shipments)
    .where(
      and(
        eq(shipments.id, shipmentId),
        eq(shipments.tenantId, actor.tenantId),
        isNull(shipments.deletedAt),
      ),
    )
    .limit(1)
    .all();

  if (!row) {
    throw new ApiError("SHIPMENT_NOT_FOUND", "That shipment does not exist.");
  }

  const trackingIdRaw = internalIdEnvelope(row.trackingId, true);
  const carrierTrackingIdRaw = carrierIdEnvelope(
    row.carrierTrackingId,
    true,
  );

  db.transaction((tx) => {
    recordAudit(tx, actor, {
      action: "tracking.revealed",
      entityType: "shipment",
      entityId: shipmentId,
      entityLabel: row.trackingId,
      severity: "warn",
      summary: `${actor.name} revealed tracking IDs for ${row.trackingId}`,
    });
  });

  return {
    shipmentId,
    trackingId: trackingIdRaw,
    carrierTrackingId: carrierTrackingIdRaw,
    revealSeconds: 30,
  };
}
