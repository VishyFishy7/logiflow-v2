/**
 * Fixture tests — PRD §9.3.
 *
 * demoDataset(fixedNow) determinism, DTO schema validation,
 * referential integrity, status/date coherence.
 */
import { describe, it, expect } from "vitest";
import { demoDataset } from "../fixtures";
import {
  zShipment,
  zClient,
  zCarrier,
  zLead,
  zLeadActivity,
  zInvoice,
  zInvoiceLine,
  zAuditEvent,
  zNotification,
  zTenant,
  zUser,
} from "../entities";

const FIXED_NOW = Date.UTC(2026, 8, 13, 9, 0, 0); // 13 Sep 2026 09:00 UTC

describe("demoDataset", () => {
  const ds = demoDataset(FIXED_NOW);

  it("is deterministic — two calls produce identical results", () => {
    const ds2 = demoDataset(FIXED_NOW);
    expect(ds.tenant).toEqual(ds2.tenant);
    expect(ds.shipments.length).toBe(ds2.shipments.length);
    expect(ds.checkpoints.length).toBe(ds2.checkpoints.length);
    expect(ds.invoices.length).toBe(ds2.invoices.length);
    expect(ds.leads.length).toBe(ds2.leads.length);
    expect(ds.auditEvents.length).toBe(ds2.auditEvents.length);
    // Spot-check deep equality of first shipment
    expect(ds.shipments[0]).toEqual(ds2.shipments[0]);
    expect(ds.invoices[0]).toEqual(ds2.invoices[0]);
  });

  it("has the fixed now value", () => {
    expect(ds.now).toBe(FIXED_NOW);
  });
});

// ── Schema validation ───────────────────────────────────────────────────────
describe("DTO schema validation", () => {
  const ds = demoDataset(FIXED_NOW);

  it("tenant validates", () => {
    expect(() => zTenant.parse(ds.tenant)).not.toThrow();
  });

  it("all users validate", () => {
    for (const user of ds.users) {
      expect(() => zUser.parse(user)).not.toThrow();
    }
  });

  it("all clients validate", () => {
    for (const client of ds.clients) {
      expect(() => zClient.parse(client)).not.toThrow();
    }
  });

  it("all carriers validate", () => {
    for (const carrier of ds.carriers) {
      expect(() => zCarrier.parse(carrier)).not.toThrow();
    }
  });

  it("all shipments validate", () => {
    for (const shipment of ds.shipments) {
      expect(() => zShipment.parse(shipment)).not.toThrow();
    }
  });

  it("all leads validate", () => {
    for (const lead of ds.leads) {
      expect(() => zLead.parse(lead)).not.toThrow();
    }
  });

  it("all lead activities validate", () => {
    for (const act of ds.leadActivities) {
      expect(() => zLeadActivity.parse(act)).not.toThrow();
    }
  });

  it("all invoices validate", () => {
    for (const invoice of ds.invoices) {
      expect(() => zInvoice.parse(invoice)).not.toThrow();
    }
  });

  it("all invoice lines validate", () => {
    for (const line of ds.invoiceLines) {
      expect(() => zInvoiceLine.parse(line)).not.toThrow();
    }
  });

  it("all audit events validate", () => {
    for (const event of ds.auditEvents) {
      expect(() => zAuditEvent.parse(event)).not.toThrow();
    }
  });

  it("all notifications validate", () => {
    for (const notif of ds.notifications) {
      expect(() => zNotification.parse(notif)).not.toThrow();
    }
  });
});

// ── Referential integrity ───────────────────────────────────────────────────
describe("referential integrity", () => {
  const ds = demoDataset(FIXED_NOW);

  it("every shipment.client.id exists in clients", () => {
    const clientIds = new Set(ds.clients.map((c) => c.id));
    for (const s of ds.shipments) {
      expect(clientIds.has(s.client.id)).toBe(true);
    }
  });

  it("every checkpoint.shipmentId exists in shipments", () => {
    const shipmentIds = new Set(ds.shipments.map((s) => s.id));
    for (const cp of ds.checkpoints) {
      expect(shipmentIds.has(cp.shipmentId)).toBe(true);
    }
  });

  it("invoice lines sum to the invoice subtotal and total", () => {
    for (const invoice of ds.invoices) {
      if (!invoice.lines || invoice.lines.length === 0) continue;
      const subtotal = invoice.lines.reduce((sum, l) => sum + l.amountPaise, 0);
      const tax = invoice.lines.reduce(
        (sum, l) => sum + Math.round((l.amountPaise * l.taxRateBp) / 10_000),
        0,
      );
      expect(subtotal).toBe(invoice.subtotalPaise);
      expect(tax).toBe(invoice.taxPaise);
      expect(subtotal + tax).toBe(invoice.totalPaise);
    }
  });

  it("every lead activity belongs to a lead", () => {
    const leadIds = new Set(ds.leads.map((l) => l.id));
    for (const act of ds.leadActivities) {
      expect(leadIds.has(act.leadId)).toBe(true);
    }
  });

  it("every audit event entityIds resolve (shipment/invoice ids exist or is tenant id)", () => {
    const shipmentIds = new Set(ds.shipments.map((s) => s.id));
    const invoiceIds = new Set(ds.invoices.map((i) => i.id));
    for (const event of ds.auditEvents) {
      if (event.entityType === "shipment" || event.entityType === "checkpoint" || event.entityType === "tracking") {
        expect(shipmentIds.has(event.entityId)).toBe(true);
      } else if (event.entityType === "invoice") {
        expect(invoiceIds.has(event.entityId)).toBe(true);
      } else {
        // settings, system, export, team, auth → tenant id
        expect(event.entityId).toBe(ds.tenant.id);
      }
    }
  });
});

// ── Status/date coherence ───────────────────────────────────────────────────
describe("status/date coherence", () => {
  const ds = demoDataset(FIXED_NOW);

  it("delivered shipments have deliveredAt set", () => {
    for (const s of ds.shipments) {
      if (s.status === "delivered") {
        expect(s.deliveredAt).not.toBeNull();
        expect(s.deliveredAt).toBeGreaterThan(0);
      }
    }
  });

  it("delayed shipments have delayReason set", () => {
    for (const s of ds.shipments) {
      if (s.status === "delayed") {
        expect(s.delayReason).not.toBeNull();
        expect((s.delayReason as string).length).toBeGreaterThan(0);
      }
    }
  });

  it("non-delayed shipments have delayReason null", () => {
    for (const s of ds.shipments) {
      if (s.status !== "delayed") {
        expect(s.delayReason).toBeNull();
      }
    }
  });

  it("overdue invoices have dueDate in the past (relative to now)", () => {
    for (const inv of ds.invoices) {
      if (inv.status === "overdue") {
        expect(inv.dueDate).toBeLessThan(FIXED_NOW);
      }
    }
  });

  it("all shipments have trackingId values that are MaskedValue objects", () => {
    for (const s of ds.shipments) {
      expect(typeof s.trackingId.value).toBe("string");
      expect(typeof s.trackingId.masked).toBe("boolean");
      expect(typeof s.trackingId.policy).toBe("string");
    }
  });

  it("all shipments have non-negative packages", () => {
    for (const s of ds.shipments) {
      expect(s.packages).toBeGreaterThanOrEqual(1);
    }
  });

  it("all shipments have non-negative weightGrams", () => {
    for (const s of ds.shipments) {
      expect(s.weightGrams).toBeGreaterThan(0);
    }
  });
});

// ── Dataset sizes ───────────────────────────────────────────────────────────
describe("dataset sizes", () => {
  const ds = demoDataset(FIXED_NOW);

  it("has 7 users", () => {
    expect(ds.users.length).toBe(7);
  });

  it("has at least 20 clients", () => {
    expect(ds.clients.length).toBeGreaterThanOrEqual(20);
  });

  it("has at least 50 shipments", () => {
    expect(ds.shipments.length).toBeGreaterThanOrEqual(50);
  });

  it("has checkpoints for every shipment", () => {
    const shipmentIds = new Set(ds.shipments.map((s) => s.id));
    for (const cp of ds.checkpoints) {
      expect(shipmentIds.has(cp.shipmentId)).toBe(true);
    }
  });

  it("has at least 300 audit events", () => {
    expect(ds.auditEvents.length).toBeGreaterThanOrEqual(300);
  });
});
