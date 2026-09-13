"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "vaul";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/spectrumui/dialog";
import { cn } from "@/lib/utils";

/**
 * §13.3 Responsive surfaces. A form or detail panel is a centred dialog on a
 * desktop and a bottom sheet on a phone — the same component, the same
 * content, chosen by viewport. Pages never branch on width themselves.
 */
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [breakpointPx]);

  return isMobile;
}

export interface ResponsiveOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Width of the desktop dialog. */
  maxWidthClassName?: string;
}

export function ResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  maxWidthClassName = "sm:max-w-lg",
}: ResponsiveOverlayProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
          <Drawer.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-border bg-card outline-none",
              className,
            )}
          >
            <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="px-5 pt-2 text-[15px] font-semibold">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="px-5 pt-1 text-[13px] text-muted-foreground">
                {description}
              </Drawer.Description>
            ) : null}
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex items-center gap-2 border-t border-border px-5 py-3.5 pb-safe">
                {footer}
              </div>
            ) : (
              <div className="pb-safe" />
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(maxWidthClassName, className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto py-1">{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Destructive and irreversible actions always come through here, so the
 * confirm step reads the same everywhere (§9.6).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <LoadingButton
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
            loading={pending}
          >
            {confirmLabel}
          </LoadingButton>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        This action is recorded in the audit log.
      </p>
    </ResponsiveOverlay>
  );
}
