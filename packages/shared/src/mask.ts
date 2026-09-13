/**
 * Tracking-ID masking. See PRD §8.3.
 *
 * The mask is applied **server-side**: a payload only ever contains a bare ID
 * when the caller holds `tracking:reveal`. Everything else gets the masked
 * string plus `masked: true`, so the raw value never reaches the DOM.
 */

export type MaskPolicy = "last2" | "first2_last2" | "full" | "none";

export const MASK_BULLET = "\u2022"; // •

export function maskSecret(value: string, policy: MaskPolicy = "last2"): string {
  if (policy === "none") return value;
  if (policy === "full") return MASK_BULLET.repeat(Math.max(8, value.length));

  const prefixMatch = /^([A-Z0-9]{2,5})-/.exec(value);
  const prefix = prefixMatch ? `${prefixMatch[1]}-` : "";
  const body = prefix ? value.slice(prefix.length) : value;

  if (!body) return MASK_BULLET.repeat(8);

  if (policy === "last2") {
    const visible = body.slice(-2);
    const hidden = MASK_BULLET.repeat(Math.max(2, body.length - 2));
    return `${prefix}${hidden}${visible}`;
  }

  // first2_last2 — used for carrier docket numbers and unmasked-adjacent views.
  if (body.length <= 4) {
    return `${prefix}${MASK_BULLET.repeat(Math.max(2, body.length))}`;
  }
  const head = body.slice(0, 2);
  const tail = body.slice(-2);
  const hidden = MASK_BULLET.repeat(Math.max(2, body.length - 4));
  return `${prefix}${head}${hidden}${tail}`;
}

/** Default policies from §8.3 — internal IDs `last2`, carrier IDs `first2_last2`. */
export const INTERNAL_ID_POLICY: MaskPolicy = "last2";
export const CARRIER_ID_POLICY: MaskPolicy = "first2_last2";

export function maskTrackingId(id: string, policy: MaskPolicy = INTERNAL_ID_POLICY): string {
  return maskSecret(id, policy);
}

export function maskCarrierTrackingId(id: string, policy: MaskPolicy = CARRIER_ID_POLICY): string {
  return maskSecret(id, policy);
}

export interface MaskedValue {
  /** Display form — safe everywhere. */
  value: string;
  /** The bare value. Present only for callers holding `tracking:reveal`. */
  raw?: string;
  masked: boolean;
  policy: MaskPolicy;
}

export function asMaskedValue(raw: string | null | undefined, policy: MaskPolicy): MaskedValue {
  if (raw === null || raw === undefined || raw === "") {
    return { value: "—", masked: false, policy };
  }
  return { value: maskSecret(raw, policy), masked: policy !== "none", policy };
}

/** Values that must never reach a log line (pino redaction list, §8.3 rule 5). */
export const REDACTED_LOG_PATHS = [
  "tracking_id",
  "trackingId",
  "carrier_tracking_id",
  "carrierTrackingId",
  "password",
  "password_hash",
  "passwordHash",
  "authorization",
  "cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];
