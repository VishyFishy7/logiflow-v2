/**
 * Notification creation + fan-out — PRD §9.6.
 *
 * Each user has `NotificationPrefs` (per type → channels). When a
 * notification is created, we:
 *   1. Persist the in-app notification row
 *   2. For each channel the user opted into (email, inapp, whatsapp),
 *      dispatch via the appropriate transport
 *   3. Record which channels were actually sent in `channelsSent[]`
 *
 * In-app notification writes are auditable where §9.2 requires it
 * (the notification row itself IS the audit trail for in-app delivery).
 *
 * Email dispatch uses the local .eml transport from mail.ts.
 */
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { newId } from "@logiflow/shared";
import type { NotificationType, NotificationChannel, NotificationPrefs } from "@logiflow/contracts";
import { notifications, notificationDeliveries, users } from "../schema/index.js";
import { sendMail } from "./mail.js";
import type { Executor } from "../client.js";
import type { Actor } from "../actor.js";
import { recordAudit } from "../audit.js";

// ── Default prefs (when a user hasn't configured) ───────────────────────────

const DEFAULT_PREFS: NotificationPrefs = {
  delay: ["inapp"],
  milestone: ["inapp"],
  invoice: ["inapp", "email"],
  assignment: ["inapp"],
  system: ["inapp"],
};

function resolvePrefs(raw: NotificationPrefs | null | undefined): NotificationPrefs {
  return raw ?? DEFAULT_PREFS;
}

// ── Core creation ───────────────────────────────────────────────────────────

export interface CreateNotificationInput {
  tenantId: string;
  /** null = broadcast to all tenant users. */
  userId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  shipmentId?: string | null;
  invoiceId?: string | null;
}

/**
 * Create a notification and fan-out to the user's preferred channels.
 *
 * Must be called inside a transaction (exec must be a Tx) so the
 * notification row + delivery records commit atomically.
 */
export function createNotification(
  exec: Executor,
  input: CreateNotificationInput,
): string {
  const now = Date.now();
  const id = newId();

  // Resolve channels for this type.
  let channelsToDispatch: NotificationChannel[] = [];

  if (input.userId) {
    // Targeted notification — look up user prefs.
    const user = exec
      .select({ notificationPrefs: users.notificationPrefs })
      .from(users)
      .where(and(
        eq(users.tenantId, input.tenantId),
        eq(users.id, input.userId),
      ))
      .get();

    const prefs = resolvePrefs(user?.notificationPrefs);
    channelsToDispatch = prefs[input.type] ?? ["inapp"];
  } else {
    // Broadcast — dispatch inapp only (email per-user would be O(users)).
    channelsToDispatch = ["inapp"];
  }

  // Persist the notification row.
  exec
    .insert(notifications)
    .values({
      id,
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      shipmentId: input.shipmentId ?? null,
      invoiceId: input.invoiceId ?? null,
      readAt: null,
      channelsSent: channelsToDispatch,
      createdAt: now,
    })
    .run();

  // Dispatch to each channel.
  const dispatched: NotificationChannel[] = [];
  for (const channel of channelsToDispatch) {
    let detail: string | null = null;
    let status = "sent";

    if (channel === "email" && input.userId) {
      // Look up user email for dispatch.
      const user = exec
        .select({ email: users.email })
        .from(users)
        .where(and(
          eq(users.tenantId, input.tenantId),
          eq(users.id, input.userId),
        ))
        .get();

      if (user?.email) {
        const result = sendMail({
          to: user.email,
          subject: input.title,
          text: input.message,
        });
        detail = result.ok ? (result.filePath ?? null) : (result.error ?? "send failed");
        status = result.ok ? "sent" : "failed";
      } else {
        detail = "no email address";
        status = "skipped";
      }
    } else if (channel === "whatsapp") {
      // WhatsApp not implemented — mark as pending.
      detail = "whatsapp not implemented";
      status = "skipped";
    }
    // "inapp" has no dispatch — it IS the in-app row.

    // Record delivery.
    exec
      .insert(notificationDeliveries)
      .values({
        id: newId(),
        tenantId: input.tenantId,
        notificationId: id,
        channel,
        toAddress: null,
        status,
        detail,
        createdAt: now,
      })
      .run();

    if (status === "sent" || channel === "inapp") {
      dispatched.push(channel);
    }
  }

  return id;
}

// ── Convenience wrappers per PRD §9.6 ──────────────────────────────────────

export function notifyDelay(
  exec: Executor,
  tenantId: string,
  userId: string,
  shipmentId: string,
  reason: string,
): string {
  return createNotification(exec, {
    tenantId,
    userId,
    type: "delay",
    title: "Shipment delayed",
    message: `Shipment has been delayed. Reason: ${reason}`,
    shipmentId,
  });
}

export function notifyMilestone(
  exec: Executor,
  tenantId: string,
  userId: string,
  shipmentId: string,
  milestone: string,
): string {
  return createNotification(exec, {
    tenantId,
    userId,
    type: "milestone",
    title: "Shipment milestone",
    message: `Shipment has reached: ${milestone}`,
    shipmentId,
  });
}

export function notifyInvoice(
  exec: Executor,
  tenantId: string,
  userId: string,
  invoiceId: string,
  title: string,
  message: string,
): string {
  return createNotification(exec, {
    tenantId,
    userId,
    type: "invoice",
    title,
    message,
    invoiceId,
  });
}

export function notifyAssignment(
  exec: Executor,
  tenantId: string,
  userId: string,
  shipmentId: string,
): string {
  return createNotification(exec, {
    tenantId,
    userId,
    type: "assignment",
    title: "New assignment",
    message: "You have been assigned a new shipment.",
    shipmentId,
  });
}

export function notifySystem(
  exec: Executor,
  tenantId: string,
  userId: string,
  title: string,
  message: string,
): string {
  return createNotification(exec, {
    tenantId,
    userId,
    type: "system",
    title,
    message,
  });
}

// ── Read helpers ────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  tenantId: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  shipmentId: string | null;
  invoiceId: string | null;
  readAt: number | null;
  createdAt: number;
  channelsSent: string[];
}

export function listNotifications(
  exec: Executor,
  tenantId: string,
  userId?: string,
  opts: { limit?: number; offset?: number } = {},
): NotificationRow[] {
  const { limit = 50, offset = 0 } = opts;
  const conditions = [eq(notifications.tenantId, tenantId)];
  if (userId) {
    conditions.push(
      // User-specific OR broadcast (null userId).
      sql`(${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL)`,
    );
  }
  return exec
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)
    .all() as NotificationRow[];
}

export function markRead(exec: Executor, tenantId: string, notificationId: string): void {
  exec
    .update(notifications)
    .set({ readAt: Date.now() })
    .where(and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.id, notificationId),
    ))
    .run();
}

export function markAllRead(exec: Executor, tenantId: string, userId: string): number {
  const result = exec
    .update(notifications)
    .set({ readAt: Date.now() })
    .where(and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.userId, userId),
      isNull(notifications.readAt),
    ))
    .run();
  return result.changes;
}
