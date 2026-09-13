/**
 * White-label configuration — PRD §6.3.
 *
 * v1's `src/config/brand.ts` module becomes a tenant row plus an optional env
 * override for local development. Resolution order:
 *   env override → tenant row → defaults.
 * No component reads `brand` directly; it comes from `useBrand()` (client) or
 * the tenant loader (server).
 */

export interface BrandConfig {
  companyName: string;
  productName: string;
  tagline: string;
  trackingPrefix: string;
  supportEmail: string;
  theme: {
    primary: string;
    primaryDark: string;
    accent: string;
    sidebarBg: string;
  };
}

/** Defaults mirror the v1 brand module for the Five Logistics pilot. */
export const DEFAULT_BRAND: BrandConfig = {
  companyName: "Five Logistics",
  productName: "LogiFlow",
  tagline: "Freight operations, without the spreadsheet.",
  trackingPrefix: "5LX",
  supportEmail: "support@fivelogistics.in",
  theme: {
    primary: "#0284c7",
    primaryDark: "#38bdf8",
    accent: "#0ea5e9",
    sidebarBg: "#0b1220",
  },
};

export interface TenantBrandSource {
  companyName?: string | null;
  productName?: string | null;
  tagline?: string | null;
  trackingPrefix?: string | null;
  supportEmail?: string | null;
  themePrimary?: string | null;
  themePrimaryDark?: string | null;
  themeAccent?: string | null;
  themeSidebarBg?: string | null;
}

export interface BrandEnvOverride {
  NEXT_PUBLIC_BRAND_COMPANY_NAME?: string;
  NEXT_PUBLIC_BRAND_PRODUCT_NAME?: string;
  NEXT_PUBLIC_BRAND_TAGLINE?: string;
  NEXT_PUBLIC_BRAND_TRACKING_PREFIX?: string;
  NEXT_PUBLIC_BRAND_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_BRAND_PRIMARY?: string;
  NEXT_PUBLIC_BRAND_PRIMARY_DARK?: string;
  NEXT_PUBLIC_BRAND_ACCENT?: string;
  NEXT_PUBLIC_BRAND_SIDEBAR_BG?: string;
}

export function resolveBrand(
  tenant?: TenantBrandSource | null,
  env: BrandEnvOverride = {},
): BrandConfig {
  const theme = {
    primary: env.NEXT_PUBLIC_BRAND_PRIMARY ?? tenant?.themePrimary ?? DEFAULT_BRAND.theme.primary,
    primaryDark:
      env.NEXT_PUBLIC_BRAND_PRIMARY_DARK ?? tenant?.themePrimaryDark ?? DEFAULT_BRAND.theme.primaryDark,
    accent: env.NEXT_PUBLIC_BRAND_ACCENT ?? tenant?.themeAccent ?? DEFAULT_BRAND.theme.accent,
    sidebarBg:
      env.NEXT_PUBLIC_BRAND_SIDEBAR_BG ?? tenant?.themeSidebarBg ?? DEFAULT_BRAND.theme.sidebarBg,
  };

  return {
    companyName: env.NEXT_PUBLIC_BRAND_COMPANY_NAME ?? tenant?.companyName ?? DEFAULT_BRAND.companyName,
    productName: env.NEXT_PUBLIC_BRAND_PRODUCT_NAME ?? tenant?.productName ?? DEFAULT_BRAND.productName,
    tagline: env.NEXT_PUBLIC_BRAND_TAGLINE ?? tenant?.tagline ?? DEFAULT_BRAND.tagline,
    trackingPrefix:
      env.NEXT_PUBLIC_BRAND_TRACKING_PREFIX ?? tenant?.trackingPrefix ?? DEFAULT_BRAND.trackingPrefix,
    supportEmail:
      env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL ?? tenant?.supportEmail ?? DEFAULT_BRAND.supportEmail,
    theme,
  };
}

/**
 * Tenant theme overrides are injected as a `:root`/`.dark` block at render
 * time, so white-labelling never touches a component (PRD §12.3).
 */
export function brandThemeCss(brand: BrandConfig): string {
  return [
    `:root{--brand-primary:${brand.theme.primary};--brand-accent:${brand.theme.accent};--tenant-sidebar-bg:${brand.theme.sidebarBg};}`,
    `.dark{--brand-primary:${brand.theme.primaryDark};--brand-accent:${brand.theme.accent};}`,
  ].join("");
}
