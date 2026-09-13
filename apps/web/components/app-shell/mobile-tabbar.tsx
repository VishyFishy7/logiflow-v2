"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { LogOut, MoreHorizontal, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/spectrumui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/spectrumui/sheet";
import { useLogout, useSession } from "@/lib/api/queries";
import { ROLE_LABELS } from "@logiflow/shared";
import { MOBILE_TABS, SECONDARY_SCREENS, findNavItem, visibleNav } from "@/lib/nav";
import { useUiStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * §13.2 Phone navigation. Three destinations plus "More" — the sidebar is not
 * rendered at all below `lg`, so this is the only way around on a phone.
 */
export function MobileTabbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const open = useUiStore((state) => state.mobileMoreOpen);
  const setOpen = useUiStore((state) => state.setMobileMoreOpen);

  const role = session?.role ?? "viewer";
  const groups = visibleNav(role);
  // Whatever the tab bar cannot reach lives in the More sheet.
  const tabHrefs = new Set<string>(MOBILE_TABS.map((tab) => tab.href));
  const rest = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !tabHrefs.has(item.href)) }))
    .filter((group) => group.items.length > 0);

  const current = findNavItem(pathname);

  async function signOut() {
    await logout.mutateAsync();
    setOpen(false);
    router.replace("/login");
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      >
        {MOBILE_TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors duration-150",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tabbar-active"
                  aria-hidden
                  className="absolute top-0 h-[2px] w-9 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="size-[18px]" />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors duration-150",
            rest.length === 0 ? "text-muted-foreground" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-[18px]" />
          More
        </button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[300px] p-0">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-[15px]">
              {session?.tenant.productName ?? "LogiFlow"}
            </SheetTitle>
            <SheetDescription className="text-[12.5px]">
              {session?.user.name}
              {session?.role ? ` · ${ROLE_LABELS[session.role]}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-3.5">
            {rest.map((group) => (
              <div key={group.id} className="mb-4 last:mb-0">
                <p className="px-2 pb-1.5 text-[10.5px] font-medium tracking-[0.09em] text-muted-foreground/80 uppercase">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150",
                            active
                              ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="mt-2 border-t border-border pt-3">
              <p className="px-2 pb-1.5 text-[10.5px] font-medium tracking-[0.09em] text-muted-foreground/80 uppercase">
                You
              </p>
              <ul className="space-y-0.5">
                {SECONDARY_SCREENS.map((screen) => (
                  <li key={screen.href}>
                    <Link
                      href={screen.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                    >
                      {screen.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center gap-1.5">
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon className="size-3.5" />
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={signOut}
              disabled={logout.isPending}
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Keeps the current destination readable while the sheet is closed. */}
      <span className="sr-only">{current?.label}</span>
    </>
  );
}
