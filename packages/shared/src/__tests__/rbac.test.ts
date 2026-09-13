/**
 * RBAC tests — PRD §7.
 *
 * MATRIX integrity: every role × every permission key has an explicit grant;
 * permissionsFor never returns a denied key; §7.2 read-scope resolution order.
 */
import { describe, it, expect } from "vitest";
import {
  ROLES,
  PERMISSIONS,
  MATRIX,
  permissionsFor,
  grantFor,
  can,
  grantsAll,
  ROLE_LABELS,
  ASSIGNABLE_ROLES,
  type Role,
  type Permission,
} from "../rbac";

// ── MATRIX integrity ────────────────────────────────────────────────────────
describe("MATRIX", () => {
  it("has exactly 7 roles", () => {
    expect(Object.keys(MATRIX).length).toBe(7);
  });

  it("every role covers every permission key (no missing entries)", () => {
    for (const role of ROLES) {
      for (const perm of PERMISSIONS) {
        expect(MATRIX[role]![perm]).toBeDefined();
      }
    }
  });

  it("every grant value is one of the four valid values", () => {
    const valid = new Set(["all", "assigned", "own_clients", "deny"]);
    for (const role of ROLES) {
      for (const perm of PERMISSIONS) {
        expect(valid.has(MATRIX[role]![perm]!)).toBe(true);
      }
    }
  });

  it("owner has 'all' for every permission", () => {
    for (const perm of PERMISSIONS) {
      expect(MATRIX.owner![perm]).toBe("all");
    }
  });

  it("admin has 'all' for every permission except billing:manage", () => {
    for (const perm of PERMISSIONS) {
      if (perm === "billing:manage") {
        expect(MATRIX.admin![perm]).toBe("deny");
      } else {
        expect(MATRIX.admin![perm]).toBe("all");
      }
    }
  });

  it("dispatcher does NOT have shipment:read_all", () => {
    expect(MATRIX.dispatcher!["shipment:read_all"]).toBe("deny");
  });

  it("dispatcher has shipment:read_assigned = 'all'", () => {
    expect(MATRIX.dispatcher!["shipment:read_assigned"]).toBe("all");
  });

  it("dispatcher has shipment:update = 'assigned' (not 'all')", () => {
    expect(MATRIX.dispatcher!["shipment:update"]).toBe("assigned");
  });

  it("sales has shipment:read_all = 'own_clients'", () => {
    expect(MATRIX.sales!["shipment:read_all"]).toBe("own_clients");
  });

  it("viewer has audit:read = 'all' but no audit:export", () => {
    expect(MATRIX.viewer!["audit:read"]).toBe("all");
    expect(MATRIX.viewer!["audit:export"]).toBe("deny");
  });

  it("accounts does NOT have invoice:manage? — actually does (PRD §7.2)", () => {
    expect(MATRIX.accounts!["invoice:manage"]).toBe("all");
  });

  it("accounts does NOT have shipment:log_status", () => {
    expect(MATRIX.accounts!["shipment:log_status"]).toBe("deny");
  });

  it("sales does NOT have shipment:log_status", () => {
    expect(MATRIX.sales!["shipment:log_status"]).toBe("deny");
  });

  it("viewer does NOT have shipment:create", () => {
    expect(MATRIX.viewer!["shipment:create"]).toBe("deny");
  });
});

// ── permissionsFor ──────────────────────────────────────────────────────────
describe("permissionsFor", () => {
  it("returns only non-deny permissions", () => {
    for (const role of ROLES) {
      const perms = permissionsFor(role);
      for (const perm of perms) {
        expect(MATRIX[role]![perm]).not.toBe("deny");
      }
    }
  });

  it("does not return a denied key for any role", () => {
    for (const role of ROLES) {
      const perms = permissionsFor(role);
      const denied = PERMISSIONS.filter((p) => MATRIX[role]![p] === "deny");
      for (const d of denied) {
        expect(perms).not.toContain(d);
      }
    }
  });

  it("owner gets all permissions", () => {
    const perms = permissionsFor("owner");
    for (const perm of PERMISSIONS) {
      expect(perms).toContain(perm);
    }
  });

  it("viewer gets exactly: shipment:read_assigned, lead:read_assigned, audit:read", () => {
    const perms = permissionsFor("viewer");
    expect(perms).toContain("shipment:read_assigned");
    expect(perms).toContain("lead:read_assigned");
    expect(perms).toContain("audit:read");
    expect(perms.length).toBe(3);
  });

  it("dispatcher gets the right set", () => {
    const perms = permissionsFor("dispatcher");
    expect(perms).toContain("shipment:create");
    expect(perms).toContain("shipment:read_assigned");
    expect(perms).toContain("shipment:update");
    expect(perms).toContain("shipment:log_status");
    expect(perms).toContain("client:read");
    expect(perms).toContain("lead:read_assigned");
    expect(perms).toContain("lead:manage");
    expect(perms).toContain("analytics:view");
    // Does NOT have:
    expect(perms).not.toContain("shipment:read_all");
    expect(perms).not.toContain("shipment:delete");
    expect(perms).not.toContain("shipment:assign");
    expect(perms).not.toContain("invoice:read");
    expect(perms).not.toContain("invoice:manage");
    expect(perms).not.toContain("audit:read");
    expect(perms).not.toContain("audit:export");
    expect(perms).not.toContain("billing:manage");
  });
});

// ── grantFor / can / grantsAll ──────────────────────────────────────────────
describe("grantFor / can / grantsAll", () => {
  it("grantFor returns the correct grant", () => {
    expect(grantFor("owner", "billing:manage")).toBe("all");
    expect(grantFor("admin", "billing:manage")).toBe("deny");
    expect(grantFor("dispatcher", "shipment:update")).toBe("assigned");
  });

  it("grantFor returns 'deny' for unknown role gracefully", () => {
    // @ts-expect-error — testing bad input
    expect(grantFor("nonexistent", "billing:manage")).toBe("deny");
  });

  it("can returns true for granted permissions", () => {
    expect(can("owner", "billing:manage")).toBe(true);
    expect(can("admin", "billing:manage")).toBe(false);
  });

  it("grantsAll returns true only for 'all' grant", () => {
    expect(grantsAll("owner", "billing:manage")).toBe(true);
    expect(grantsAll("dispatcher", "shipment:update")).toBe(false);
    expect(grantsAll("dispatcher", "shipment:create")).toBe(true);
  });
});

// ── §7.2 read-scope resolution order ────────────────────────────────────────
describe("§7.2 read-scope resolution", () => {
  it("owner/admin/ops_manager get 'all' for shipment:read_all", () => {
    expect(grantFor("owner", "shipment:read_all")).toBe("all");
    expect(grantFor("admin", "shipment:read_all")).toBe("all");
    expect(grantFor("ops_manager", "shipment:read_all")).toBe("all");
  });

  it("dispatcher gets 'all' for shipment:read_assigned (not 'own_clients')", () => {
    expect(grantFor("dispatcher", "shipment:read_assigned")).toBe("all");
    // dispatcher does NOT have read_all
    expect(grantFor("dispatcher", "shipment:read_all")).toBe("deny");
  });

  it("sales gets 'own_clients' for shipment:read_all", () => {
    expect(grantFor("sales", "shipment:read_all")).toBe("own_clients");
  });

  it("accounts gets 'all' for shipment:read_all", () => {
    expect(grantFor("accounts", "shipment:read_all")).toBe("all");
  });

  it("viewer gets 'all' for shipment:read_assigned", () => {
    expect(grantFor("viewer", "shipment:read_assigned")).toBe("all");
  });

  it("lead:read_all scope follows the same pattern", () => {
    expect(grantFor("sales", "lead:read_all")).toBe("all");
    expect(grantFor("dispatcher", "lead:read_all")).toBe("deny");
    expect(grantFor("dispatcher", "lead:read_assigned")).toBe("all");
  });
});

// ── ROLE_LABELS ─────────────────────────────────────────────────────────────
describe("ROLE_LABELS", () => {
  it("covers every role", () => {
    for (const role of ROLES) {
      expect(typeof ROLE_LABELS[role]).toBe("string");
      expect(ROLE_LABELS[role]!.length).toBeGreaterThan(0);
    }
  });
});

// ── ASSIGNABLE_ROLES ────────────────────────────────────────────────────────
describe("ASSIGNABLE_ROLES", () => {
  it("includes owner, admin, ops_manager, dispatcher", () => {
    expect(ASSIGNABLE_ROLES).toContain("owner");
    expect(ASSIGNABLE_ROLES).toContain("admin");
    expect(ASSIGNABLE_ROLES).toContain("ops_manager");
    expect(ASSIGNABLE_ROLES).toContain("dispatcher");
  });

  it("does NOT include accounts, sales, viewer", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("accounts");
    expect(ASSIGNABLE_ROLES).not.toContain("sales");
    expect(ASSIGNABLE_ROLES).not.toContain("viewer");
  });
});
