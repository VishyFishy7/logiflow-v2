/**
 * Tenant repository — brand settings, tracking config, vocabularies.
 *
 * PRD §14.11 — Settings sections. Every write is audited. The tracking
 * prefix is immutable once shipments exist (enforced here with an
 * explanation in the audit summary).
 */
import { eq, and, sql } from "drizzle-orm";
import { isValidPrefix } from "@logiflow/shared";
import type { BrandPreview } from "@logiflow/contracts";
import { db, type Executor } from "../client.js";
import { tenants, shipments } from "../schema/index.js";
import { ApiError } from "../errors.js";
import { recordAudit, diffChanges } from "../audit.js";
import type { Actor } from "../actor.js";
import { isValidHexColour, isValidTimezone } from "../services/settings.js";

// ── Read ────────────────────────────────────────────────────────────────────

/**
 * Get a tenant by ID.
 */
export function getTenant(id: string): typeof tenants.$inferSelect | null {
  return db.select().from(tenants).where(eq(tenants.id, id)).get() ?? null;
}

/**
 * Get a tenant by slug.
 */
export function getTenantBySlug(slug: string): typeof tenants.$inferSelect | null {
  return db.select().from(tenants).where(eq(tenants.slug, slug)).get() ?? null;
}

// ── Brand update ────────────────────────────────────────────────────────────

/**
 * Update the tenant's brand settings.
 *
 * Fields: company name, product name, tagline, support email,
 * the four theme colours, plan, timezone, currency.
 *
 * Note: the tracking prefix is immutable once shipments exist — see
 * `updateTrackingSettings` for prefix changes.
 */
export function updateTenantBrand(
  actor: Actor,
  input: {
    companyName?: string | null;
    productName?: string | null;
    tagline?: string | null;
    supportEmail?: string | null;
    themePrimary?: string | null;
    themePrimaryDark?: string | null;
    themeAccent?: string | null;
    themeSidebarBg?: string | null;
    plan?: string | null;
    timezone?: string | null;
    currency?: string | null;
  },
): typeof tenants.$inferSelect {
  const now = Date.now();

  const before = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
  if (!before) throw new ApiError("TENANT_NOT_FOUND", "Tenant not found");

  // Validate colours.
  const colourFields: Array<[string, string | null | undefined]> = [
    ["themePrimary", input.themePrimary],
    ["themePrimaryDark", input.themePrimaryDark],
    ["themeAccent", input.themeAccent],
    ["themeSidebarBg", input.themeSidebarBg],
  ];
  for (const [field, value] of colourFields) {
    if (value !== undefined && value !== null && !isValidHexColour(value)) {
      throw new ApiError("VALIDATION_FAILED", `${field} must be a valid hex colour`, {
        fieldErrors: { [field]: "Expected #rgb or #rrggbb" },
      });
    }
  }

  // Validate timezone.
  if (input.timezone !== undefined && input.timezone !== null && input.timezone !== "") {
    if (!isValidTimezone(input.timezone)) {
      throw new ApiError("VALIDATION_FAILED", "Invalid IANA timezone", {
        fieldErrors: { timezone: "Invalid timezone" },
      });
    }
  }

  // Build the patch (only set fields that were provided and non-null).
  const patch: Record<string, unknown> = { updatedAt: now };
  if (input.companyName != null) patch.companyName = input.companyName.trim();
  if (input.productName != null) patch.productName = input.productName.trim();
  if (input.tagline != null) patch.tagline = input.tagline.trim();
  if (input.supportEmail != null) patch.supportEmail = input.supportEmail.trim();
  if (input.themePrimary != null) patch.themePrimary = input.themePrimary;
  if (input.themePrimaryDark != null) patch.themePrimaryDark = input.themePrimaryDark;
  if (input.themeAccent != null) patch.themeAccent = input.themeAccent;
  if (input.themeSidebarBg != null) patch.themeSidebarBg = input.themeSidebarBg;
  if (input.plan != null) patch.plan = input.plan;
  if (input.timezone != null) patch.timezone = input.timezone;
  if (input.currency != null) patch.currency = input.currency.toUpperCase();

  const after = db.update(tenants).set(patch).where(eq(tenants.id, actor.tenantId)).returning().get();

  // Diff capture for audit.
  const changes = diffChanges(
    {
      companyName: before.companyName,
      productName: before.productName,
      tagline: before.tagline,
      supportEmail: before.supportEmail,
      themePrimary: before.themePrimary,
      themePrimaryDark: before.themePrimaryDark,
      themeAccent: before.themeAccent,
      themeSidebarBg: before.themeSidebarBg,
      plan: before.plan,
      timezone: before.timezone,
      currency: before.currency,
    },
    {
      companyName: after.companyName,
      productName: after.productName,
      tagline: after.tagline,
      supportEmail: after.supportEmail,
      themePrimary: after.themePrimary,
      themePrimaryDark: after.themePrimaryDark,
      themeAccent: after.themeAccent,
      themeSidebarBg: after.themeSidebarBg,
      plan: after.plan,
      timezone: after.timezone,
      currency: after.currency,
    },
  );

  recordAudit(db, actor, {
    action: "settings.brand_updated",
    entityType: "settings",
    entityId: after.id,
    entityLabel: after.companyName,
    summary: `Updated brand settings for ${after.companyName}`,
    severity: "info",
    changes,
  });

  return after;
}

// ── Tracking settings ───────────────────────────────────────────────────────

/**
 * Update tracking settings: mask policy, public tracking toggle, and
 * optionally the tracking prefix.
 *
 * The tracking prefix is immutable once shipments exist — if shipments
 * are present, changing the prefix is rejected with a clear message
 * explaining why (the audit summary captures this constraint).
 */
export function updateTrackingSettings(
  actor: Actor,
  input: {
    trackingPrefix?: string | null;
    maskPolicy?: string | null;
    publicTrackingEnabled?: boolean | null;
  },
): typeof tenants.$inferSelect {
  const now = Date.now();

  const before = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
  if (!before) throw new ApiError("TENANT_NOT_FOUND", "Tenant not found");

  // Build the patch.
  const patch: Record<string, unknown> = { updatedAt: now };

  if (input.trackingPrefix != null) {
    const prefix = input.trackingPrefix.toUpperCase();

    if (!isValidPrefix(prefix)) {
      throw new ApiError("VALIDATION_FAILED", "Tracking prefix must be 2–5 uppercase alphanumerics", {
        fieldErrors: { trackingPrefix: "2–5 uppercase alphanumerics (A-Z, 0-9)" },
      });
    }

    if (prefix !== before.trackingPrefix) {
      // Check if any shipments exist — prefix is immutable once shipments are created.
      const shipmentCount = db
        .select({ count: sql<number>`count(*)` })
        .from(shipments)
        .where(eq(shipments.tenantId, actor.tenantId))
        .get()?.count ?? 0;

      if (shipmentCount > 0) {
        throw new ApiError(
          "VALIDATION_FAILED",
          "Cannot change the tracking prefix after shipments have been created. " +
            "Existing tracking IDs would become invalid.",
          {
            fieldErrors: {
              trackingPrefix:
                "Immutable once shipments exist. " +
                "All existing tracking IDs use this prefix.",
            },
          },
        );
      }

      patch.trackingPrefix = prefix;
    }
  }

  if (input.maskPolicy != null) {
    const valid = ["last2", "first2_last2", "full", "none"];
    if (!valid.includes(input.maskPolicy)) {
      throw new ApiError("VALIDATION_FAILED", "Invalid mask policy");
    }
    patch.maskPolicy = input.maskPolicy;
  }

  if (input.publicTrackingEnabled != null) {
    patch.publicTrackingEnabled = input.publicTrackingEnabled;
  }

  const after = db.update(tenants).set(patch).where(eq(tenants.id, actor.tenantId)).returning().get();

  const changes = diffChanges(
    {
      trackingPrefix: before.trackingPrefix,
      maskPolicy: before.maskPolicy,
      publicTrackingEnabled: before.publicTrackingEnabled,
    },
    {
      trackingPrefix: after.trackingPrefix,
      maskPolicy: after.maskPolicy,
      publicTrackingEnabled: after.publicTrackingEnabled,
    },
  );

  if (changes) {
    recordAudit(db, actor, {
      action: "settings.tracking_updated",
      entityType: "settings",
      entityId: after.id,
      entityLabel: after.companyName,
      summary: `Updated tracking settings (prefix: ${after.trackingPrefix}, mask: ${after.maskPolicy}, public: ${after.publicTrackingEnabled})`,
      severity: "info",
      changes,
    });
  }

  return after;
}

// ── Vocabulary lists ────────────────────────────────────────────────────────

/**
 * Update the tenant's delay-reason vocabulary.
 * These are the selectable options in the UI delay-reason dropdown.
 */
export function updateDelayReasons(actor: Actor, reasons: string[]): typeof tenants.$inferSelect {
  const now = Date.now();

  const before = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
  if (!before) throw new ApiError("TENANT_NOT_FOUND", "Tenant not found");

  const sanitised = reasons.map((r) => r.trim()).filter((r) => r.length > 0);

  const after = db
    .update(tenants)
    .set({ delayReasons: sanitised, updatedAt: now })
    .where(eq(tenants.id, actor.tenantId))
    .returning()
    .get();

  recordAudit(db, actor, {
    action: "settings.vocabulary_updated",
    entityType: "settings",
    entityId: after.id,
    entityLabel: `${after.companyName} — delay reasons`,
    summary: `Updated delay reasons: ${sanitised.length} items`,
    severity: "info",
    changes: {
      delayReasons: {
        from: before.delayReasons ?? [],
        to: sanitised,
      },
    },
  });

  return after;
}

/**
 * Update the tenant's lead-source vocabulary.
 */
export function updateLeadSources(actor: Actor, sources: string[]): typeof tenants.$inferSelect {
  const now = Date.now();

  const before = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
  if (!before) throw new ApiError("TENANT_NOT_FOUND", "Tenant not found");

  const sanitised = sources.map((s) => s.trim()).filter((s) => s.length > 0);

  const after = db
    .update(tenants)
    .set({ leadSources: sanitised, updatedAt: now })
    .where(eq(tenants.id, actor.tenantId))
    .returning()
    .get();

  recordAudit(db, actor, {
    action: "settings.vocabulary_updated",
    entityType: "settings",
    entityId: after.id,
    entityLabel: `${after.companyName} — lead sources`,
    summary: `Updated lead sources: ${sanitised.length} items`,
    severity: "info",
    changes: {
      leadSources: {
        from: before.leadSources ?? [],
        to: sanitised,
      },
    },
  });

  return after;
}

// ── Brand preview ───────────────────────────────────────────────────────────

/**
 * Build a `BrandPreview` DTO for the live preview strip in the settings UI.
 */
export function brandPreview(actor: Actor): BrandPreview {
  const tenant = db.select().from(tenants).where(eq(tenants.id, actor.tenantId)).get();
  if (!tenant) throw new ApiError("TENANT_NOT_FOUND", "Tenant not found");

  return {
    companyName: tenant.companyName,
    productName: tenant.productName,
    tagline: tenant.tagline,
    trackingPrefix: tenant.trackingPrefix,
    supportEmail: tenant.supportEmail,
    theme: {
      primary: tenant.themePrimary,
      primaryDark: tenant.themePrimaryDark,
      accent: tenant.themeAccent,
      sidebarBg: tenant.themeSidebarBg,
    },
  };
}
