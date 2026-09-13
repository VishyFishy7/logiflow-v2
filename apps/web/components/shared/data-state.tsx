"use client";

import { isValidElement, type ReactNode } from "react";
import { AlertTriangle, Inbox, WifiOff, type LucideIcon } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { Skeleton } from "@/components/spectrumui/skeleton";
import { cn } from "@/lib/utils";

/**
 * §12.5 Five states, one implementation. Every list and detail screen shows
 * loading / empty / error / partial / ready through these components, so no
 * page invents its own spinner or its own wording.
 */

export function LoadingBlock({
  rows = 5,
  label = "Loading",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-label={label} className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-xl border border-border/60 p-3.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[38%]" />
            <Skeleton className="h-3 w-[22%]" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Renders a bare lucide icon at the size every empty state's glyph slot wants. */
function IconComponent({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-5" />;
}

/** Column-preserving skeleton for tables, so nothing jumps when data lands. */
export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading table" className="w-full">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border/50 px-3 py-[13px] last:border-0"
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-3.5", columnIndex === 0 ? "w-[22%]" : "w-[12%]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon | ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  // The prop takes a lucide icon or a ready-made element — both read the same
  // at a call site, and this keeps every empty state the same size and colour.
  const glyph = isValidElement(icon) ? (
    icon
  ) : icon ? (
    <IconComponent icon={icon as LucideIcon} />
  ) : (
    <Inbox className="size-5" />
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        {glyph}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorBlock({
  title = "That didn't load",
  description,
  onRetry,
  retrying,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-[var(--severity-error)]/25 bg-[var(--severity-error-bg)] px-5 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--severity-error)]" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--severity-error)]">{title}</p>
          {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </div>
  );
}

/** §10 — a partially served list (some sources down) still shows what it has. */
export function PartialBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-[var(--severity-warn)]/25 bg-[var(--severity-warn-bg)] px-3.5 py-2.5 text-[13px]",
        className,
      )}
    >
      <WifiOff className="size-3.5 shrink-0 text-[var(--severity-warn)]" />
      <span className="flex-1 text-muted-foreground">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--severity-warn)] transition-colors duration-150 hover:bg-[var(--severity-warn)]/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Switches between the five states in one place. Pass exactly the state you
 * have; `ready` renders children untouched.
 */
export function DataState({
  status,
  children,
  skeleton,
  empty,
  error,
  partial,
  className,
}: {
  status: "pending" | "error" | "empty" | "ready";
  children: ReactNode;
  skeleton?: ReactNode;
  empty?: ReactNode;
  error?: ReactNode;
  partial?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {partial}
      {status === "pending" ? (skeleton ?? <LoadingBlock />) : null}
      {status === "error" ? (error ?? <ErrorBlock />) : null}
      {status === "empty" ? (empty ?? <EmptyState title="Nothing here yet" />) : null}
      {status === "ready" ? children : null}
    </div>
  );
}
