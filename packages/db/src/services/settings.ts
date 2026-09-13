/**
 * Pure validation and resolution rules for the settings payloads.
 * No DB access — this is a stateless module consumed by route handlers
 * before they hand off to the repository layer.
 *
 * PRD §14.11 — settings sections, §6.3 — brand resolution.
 */
import { resolveBrand, type BrandConfig, type BrandEnvOverride, type TenantBrandSource } from "@logiflow/shared";
import { isValidPrefix } from "@logiflow/shared";

// ── Colour validation ───────────────────────────────────────────────────────

/** Matches `#rgb` or `#rrggbb` (case-insensitive). */
const HEX_COLOUR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColour(value: string): boolean {
  return HEX_COLOUR_RE.test(value.trim());
}

// ── Prefix validation ───────────────────────────────────────────────────────

/**
 * Tracking prefix rules (PRD §8.2):
 *   - 2–5 uppercase alphanumerics (A-Z, 0-9)
 *   - No look-alikes allowed in the body, but the prefix itself is unrestricted
 *     within the length/format constraint (the tracking body generator handles
 *     the alphabet restriction).
 *
 * @returns `true` when the prefix is valid.
 */
export function isValidTrackingPrefix(prefix: string): boolean {
  return isValidPrefix(prefix);
}

// ── Timezone validation ─────────────────────────────────────────────────────

/**
 * Validate that a timezone string is a real IANA zone.
 * Uses the Intl API which is available in Node 12+.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ── Brand resolution ────────────────────────────────────────────────────────

/**
 * Build the `BrandConfig` using the resolution order from PRD §6.3:
 *   env override → tenant row → defaults.
 *
 * This is a thin wrapper around `resolveBrand` from @logiflow/shared that
 * accepts the DB row shape directly.
 */
export function buildBrandConfig(
  tenant: TenantBrandSource | null | undefined,
  envOverrides: BrandEnvOverride = {},
): BrandConfig {
  return resolveBrand(tenant ?? undefined, envOverrides);
}

/**
 * Validate a brand update payload. Returns a record of field → error message.
 * An empty record means the payload is valid.
 */
export function validateBrandUpdate(input: {
  companyName?: string | null;
  productName?: string | null;
  tagline?: string | null;
  supportEmail?: string | null;
  themePrimary?: string | null;
  themePrimaryDark?: string | null;
  themeAccent?: string | null;
  themeSidebarBg?: string | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.companyName !== undefined && input.companyName !== null) {
    if (input.companyName.trim().length < 2) errors.companyName = "Company name must be at least 2 characters";
    if (input.companyName.trim().length > 120) errors.companyName = "Company name must be at most 120 characters";
  }

  if (input.productName !== undefined && input.productName !== null) {
    if (input.productName.trim().length < 2) errors.productName = "Product name must be at least 2 characters";
    if (input.productName.trim().length > 60) errors.productName = "Product name must be at most 60 characters";
  }

  if (input.tagline !== undefined && input.tagline !== null) {
    if (input.tagline.trim().length > 160) errors.tagline = "Tagline must be at most 160 characters";
  }

  if (input.supportEmail !== undefined && input.supportEmail !== null) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.supportEmail.trim())) {
      errors.supportEmail = "Invalid email address";
    }
  }

  const colourFields = ["themePrimary", "themePrimaryDark", "themeAccent", "themeSidebarBg"] as const;
  for (const field of colourFields) {
    const value = input[field];
    if (value !== undefined && value !== null && !isValidHexColour(value)) {
      errors[field] = "Expected a hex colour (#rgb or #rrggbb)";
    }
  }

  return errors;
}

/**
 * Validate a tracking settings update payload.
 */
export function validateTrackingSettings(input: {
  trackingPrefix?: string | null;
  maskPolicy?: string | null;
  publicTrackingEnabled?: boolean | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.trackingPrefix !== undefined && input.trackingPrefix !== null) {
    if (!isValidTrackingPrefix(input.trackingPrefix)) {
      errors.trackingPrefix = "Tracking prefix must be 2–5 uppercase alphanumerics";
    }
  }

  if (input.maskPolicy !== undefined && input.maskPolicy !== null) {
    const valid = ["last2", "first2_last2", "full", "none"];
    if (!valid.includes(input.maskPolicy)) {
      errors.maskPolicy = `Mask policy must be one of: ${valid.join(", ")}`;
    }
  }

  return errors;
}

/**
 * Validate tenant-level settings (timezone, currency).
 */
export function validateTenantSettings(input: {
  timezone?: string | null;
  currency?: string | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.timezone !== undefined && input.timezone !== null) {
    if (!isValidTimezone(input.timezone)) {
      errors.timezone = "Invalid IANA timezone";
    }
  }

  if (input.currency !== undefined && input.currency !== null) {
    if (!/^[A-Z]{3}$/.test(input.currency)) {
      errors.currency = "Currency must be a 3-letter ISO code";
    }
  }

  return errors;
}
