/**
 * Route table tests — PRD §9.1.
 *
 * Every API_ROUTES entry: unique method+path, a permission that exists in
 * shared PERMISSIONS, valid scope, leading-slash-free paths (after /api/v1),
 * :param naming, and a count assertion.
 */
import { describe, it, expect } from "vitest";
import { API_ROUTES } from "../routes.js";
import { PERMISSIONS } from "@logiflow/shared";
import type { Permission } from "@logiflow/shared";

describe("API_ROUTES", () => {
  it("contains at least 50 routes (PRD §9.1 endpoint count)", () => {
    expect(API_ROUTES.length).toBeGreaterThanOrEqual(50);
  });

  it("every route has a unique method+path", () => {
    const keys = API_ROUTES.map((r) => `${r.method} ${r.path}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("every permission referenced exists in the shared PERMISSIONS array", () => {
    const permSet = new Set<string>(PERMISSIONS);
    for (const route of API_ROUTES) {
      if (route.permission) {
        expect(permSet.has(route.permission)).toBe(true);
      }
    }
  });

  it("every scope value is valid", () => {
    const validScopes = new Set(["all", "assigned", "own_clients"]);
    for (const route of API_ROUTES) {
      if (route.scope) {
        expect(validScopes.has(route.scope)).toBe(true);
      }
    }
  });

  it("every access value is either 'public' or 'auth'", () => {
    for (const route of API_ROUTES) {
      expect(["public", "auth"]).toContain(route.access);
    }
  });

  it("paths start with / and do not start with /api/v1 (relative to /api/v1)", () => {
    for (const route of API_ROUTES) {
      expect(route.path.startsWith("/")).toBe(true);
      expect(route.path.startsWith("/api")).toBe(false);
    }
  });

  it(":param segments use the :name convention", () => {
    for (const route of API_ROUTES) {
      const segments = route.path.split("/").filter(Boolean);
      for (const seg of segments) {
        if (seg.startsWith(":")) {
          // Must be at least :x (2+ chars, just the colon + name)
          expect(seg.length).toBeGreaterThanOrEqual(2);
          expect(/^:[a-zA-Z]+$/.test(seg)).toBe(true);
        }
      }
    }
  });

  it("public routes do not require a permission", () => {
    for (const route of API_ROUTES) {
      if (route.access === "public") {
        expect(route.permission).toBeUndefined();
      }
    }
  });

  it("print total route count", () => {
    console.log(`API_ROUTES total: ${API_ROUTES.length}`);
    expect(API_ROUTES.length).toBeGreaterThan(0);
  });

  it("covers the core sections from PRD §9.1", () => {
    const paths = API_ROUTES.map((r) => r.path);
    // Auth
    expect(paths).toContain("/auth/login");
    expect(paths).toContain("/auth/logout");
    expect(paths).toContain("/auth/session");
    // Shipments
    expect(paths).toContain("/shipments");
    expect(paths).toContain("/shipments/:id");
    expect(paths).toContain("/shipments/:id/checkpoints");
    expect(paths).toContain("/shipments/:id/tracking/reveal");
    expect(paths).toContain("/shipments/stats");
    expect(paths).toContain("/shipments/export");
    // Clients
    expect(paths).toContain("/clients");
    // Leads
    expect(paths).toContain("/leads");
    expect(paths).toContain("/leads/:id");
    expect(paths).toContain("/leads/:id/activity");
    // Invoices
    expect(paths).toContain("/invoices");
    expect(paths).toContain("/invoices/:id");
    // Audit
    expect(paths).toContain("/audit");
    expect(paths).toContain("/audit/export");
    expect(paths).toContain("/audit/export.json");
    // Notifications
    expect(paths).toContain("/notifications");
    // Public
    expect(paths).toContain("/track/:trackingId");
    expect(paths).toContain("/webhooks/carriers/:code");
    expect(paths).toContain("/health");
    // Settings
    expect(paths).toContain("/settings");
  });
});
