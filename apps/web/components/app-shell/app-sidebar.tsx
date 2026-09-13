"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/spectrumui/tooltip";
import { useSession } from "@/lib/api/queries";
import { useUiStore } from "@/lib/store";
import { initials } from "@/lib/format";
import { visibleNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * §11.1 Desktop sidebar. White-label first: the product name, the accent and
 * the mark all come from the tenant, so a second tenant needs no code change
 * (§6.3). Nav items the role cannot use are not rendered at all (§7.4).
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const role = session?.role ?? "viewer";
  const groups = visibleNav(role);
  const productName = session?.tenant.productName ?? "LogiFlow";
  const companyName = session?.tenant.companyName ?? "";

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-[var(--sidebar)] transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] lg:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      {/* Brand — tenant product name + mark */}
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground"
        >
          {initials(productName)}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] leading-tight font-semibold">{productName}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{companyName}</p>
          </div>
        )}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2.5 py-3.5">
        {groups.map((group) => (
          <div key={group.id} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10.5px] font-medium tracking-[0.09em] text-muted-foreground/80 uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                        : "text-muted-foreground hover:bg-[var(--sidebar-accent)]/55 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        aria-hidden
                        className="absolute top-1.5 left-0 h-6 w-[2px] rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <Icon className="size-[16px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger render={link} />
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("flex items-center gap-2 border-t border-border p-2.5", collapsed && "justify-center p-2")}>
        {!collapsed && (
          <p className="flex-1 truncate px-1 text-[11px] text-muted-foreground">
            v2.0.0 · {session?.tenant.plan ?? "trial"}
          </p>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}
