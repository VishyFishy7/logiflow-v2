"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * §12.6 One page header for every screen: same title scale, same action slot,
 * same optional tab row. Detail screens put breadcrumbs in `back`.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  tabs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Small label above the title — usually the tenant product name or a client. */
  eyebrow?: ReactNode;
  /** Breadcrumb / back control rendered above the title. */
  back?: ReactNode;
  actions?: ReactNode;
  /** A TabNavbar or filter row rendered beneath the header, full width. */
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1.5">
          {back}
          {eyebrow && (
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-[21px] leading-tight font-semibold tracking-[-0.01em] sm:text-[23px]">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}

/** A titled block on a page — the surface everything else sits on. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-sm font-medium">{title}</h2>}
            {description && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Label/value pair used across detail screens. */
export function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-[13.5px] break-words">{children}</dd>
    </div>
  );
}
