/**
 * Carrier adapter layer — PRD §9.4.
 *
 * A registry keyed by `CarrierAdapterCode` (from contracts/enums.ts).
 * Each adapter is a pure function module: it receives inputs, returns
 * results, and never imports a repository or touches the database.
 *
 * The mock adapter is fully functional for dev/test and returns plausible
 * values that pass `isPlausibleCarrierTrackingId`.
 */
import { createHash } from "node:crypto";
import {
  isPlausibleCarrierTrackingId,
  newId,
} from "@logiflow/shared";
import type { CarrierAdapterCode } from "@logiflow/contracts";

// ── Types ───────────────────────────────────────────────────────────────────

export interface BookShipmentInput {
  tenantId: string;
  shipmentId: string;
  origin: string;
  destination: string;
  /** Carrier-assigned tracking id (e.g. docket number). */
  carrierTrackingId?: string;
  weightGrams: number;
  declaredValuePaise?: number;
  serviceLevel: string;
  paymentMode: string;
  numberOfPackages: number;
}

export interface BookShipmentResult {
  /** Carrier docket / tracking id. */
  carrierTrackingId: string;
  /** The carrier-specific label URL or null if not supported. */
  labelUrl: string | null;
  /** Raw carrier response for debugging. */
  raw: unknown;
}

export interface FetchStatusInput {
  tenantId: string;
  shipmentId: string;
  carrierTrackingId: string;
}

export interface CheckpointData {
  status: string;
  label: string;
  location: string | null;
  note: string | null;
  delayReason: string | null;
  occurredAt: number;
  rawPayload: unknown;
}

export interface FetchStatusResult {
  checkpoints: CheckpointData[];
  delivered: boolean;
  raw: unknown;
}

export interface WebhookPayload {
  body: unknown;
  signature?: string;
}

export interface ParsedWebhook {
  carrierTrackingId: string;
  checkpoint: CheckpointData;
}

export interface AdapterCapabilities {
  supportsWebhook: boolean;
  supportsLabelGeneration: boolean;
  /** URL template with `{trackingId}` placeholder. */
  trackingUrlTemplate: string | null;
}

export interface CarrierAdapter {
  code: CarrierAdapterCode;
  capabilities: AdapterCapabilities;

  bookShipment(input: BookShipmentInput): BookShipmentResult;
  fetchStatus(input: FetchStatusInput): FetchStatusResult;
  parseWebhook(payload: WebhookPayload): ParsedWebhook;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a plausible carrier docket number for the mock adapter.
 * Format: uppercase alphanum, 10-14 chars — passes isPlausibleCarrierTrackingId.
 */
function generateMockDocket(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)] ?? "";
  }
  return result;
}

// ── Mock adapter ────────────────────────────────────────────────────────────

const mockAdapter: CarrierAdapter = {
  code: "mock",

  capabilities: {
    supportsWebhook: false,
    supportsLabelGeneration: false,
    trackingUrlTemplate: null,
  },

  bookShipment(input): BookShipmentResult {
    const carrierTrackingId = input.carrierTrackingId ?? generateMockDocket();
    // Validate it passes the plausibility check (should always be true).
    if (!isPlausibleCarrierTrackingId(carrierTrackingId)) {
      // Extremely unlikely with our generator — regenerate once.
      return this.bookShipment({ ...input, carrierTrackingId: generateMockDocket() });
    }
    return {
      carrierTrackingId,
      labelUrl: null,
      raw: { adapter: "mock", booked: true, shipmentId: input.shipmentId },
    };
  },

  fetchStatus(_input): FetchStatusResult {
    // Mock adapter returns a single in-transit checkpoint for testing.
    return {
      checkpoints: [
        {
          status: "in_transit",
          label: "In transit",
          location: "Mock Hub",
          note: "Package scanned at mock facility",
          delayReason: null,
          occurredAt: Date.now(),
          rawPayload: { adapter: "mock", scanned: true },
        },
      ],
      delivered: false,
      raw: { adapter: "mock", status: "in_transit" },
    };
  },

  parseWebhook(payload): ParsedWebhook {
    // Mock adapter doesn't support webhooks, but provide a safe parse
    // for testing the webhook endpoint.
    const body = payload.body as Record<string, unknown>;
    const carrierTrackingId = String(body["carrierTrackingId"] ?? body["tracking_id"] ?? "MOCK-UNKNOWN");
    return {
      carrierTrackingId,
      checkpoint: {
        status: "in_transit",
        label: "Webhook received",
        location: null,
        note: "Parsed from mock webhook",
        delayReason: null,
        occurredAt: Date.now(),
        rawPayload: body,
      },
    };
  },
};

// ── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<CarrierAdapterCode, CarrierAdapter>([
  ["mock", mockAdapter],
]);

/**
 * Get an adapter by its code. Throws if the code is not registered.
 * All adapters are created once at module load time — pure, no DB.
 */
export function getAdapter(code: CarrierAdapterCode): CarrierAdapter {
  const adapter = registry.get(code);
  if (!adapter) {
    throw new Error(`Carrier adapter "${code}" is not registered`);
  }
  return adapter;
}

/**
 * Register a carrier adapter (used by real adapter plugins).
 */
export function registerAdapter(adapter: CarrierAdapter): void {
  registry.set(adapter.code, adapter);
}

/**
 * Build a tracking URL from a carrier's template + tracking id.
 * Returns null if no template is configured.
 */
export function buildTrackingUrl(
  template: string | null,
  trackingId: string,
): string | null {
  if (!template) return null;
  return template.replace("{trackingId}", trackingId);
}
