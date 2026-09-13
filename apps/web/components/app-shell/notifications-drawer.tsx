"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, Flag, Info, Receipt, UserPlus } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/spectrumui/sheet";
import { EmptyState, LoadingBlock } from "@/components/shared/data-state";
import { useMarkNotificationsRead, useNotifications } from "@/lib/api/queries";
import { notificationTypeLabel, relative } from "@/lib/format";
import type { NotificationType } from "@logiflow/contracts";
import { useUiStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, typeof Info> = {
  delay: AlertTriangle,
  milestone: Flag,
  invoice: Receipt,
  assignment: UserPlus,
  system: Info,
};

/**
 * §11.3 The bell. Notifications are read-only signals — every one links back to
 * the shipment or invoice it is about, so acting on it never means retyping an
 * identifier.
 */
export function NotificationsDrawer() {
  const router = useRouter();
  const open = useUiStore((state) => state.notificationsOpen);
  const setOpen = useUiStore((state) => state.setNotificationsOpen);
  const { data, isPending } = useNotifications({ enabled: open });
  const markRead = useMarkNotificationsRead();

  const items = data?.data ?? [];
  const unread = items.filter((item) => !item.readAt);

  function openItem(id: string, target: string | null) {
    markRead.mutate(id);
    if (target) {
      setOpen(false);
      router.push(target);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-[15px]">Notifications</SheetTitle>
            {unread.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markRead.mutate(undefined)}
                disabled={markRead.isPending}
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>
          <SheetDescription className="text-[12.5px]">
            {unread.length > 0
              ? `${unread.length} unread · delays, milestones, invoices and assignments`
              : "Nothing unread. Delays, milestones, invoices and assignments land here."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <LoadingBlock rows={5} />
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Info}
                title="No notifications yet"
                description="You will hear about delays, status milestones, invoice due dates and work assigned to you."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const Icon = ICONS[item.type] ?? Info;
                const target = item.shipmentId
                  ? `/shipments/${item.shipmentId}`
                  : item.invoiceId
                    ? `/invoices/${item.invoiceId}`
                    : null;
                const unreadItem = !item.readAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item.id, target)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                        unreadItem && "bg-primary/[0.035]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                          item.type === "delay"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-[13px]",
                              unreadItem ? "font-semibold" : "font-medium",
                            )}
                          >
                            {item.title}
                          </span>
                          {unreadItem && (
                            <span
                              aria-label="Unread"
                              className="size-1.5 shrink-0 rounded-full bg-primary"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                          {item.message}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">
                          {notificationTypeLabel(item.type)} · {relative(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
