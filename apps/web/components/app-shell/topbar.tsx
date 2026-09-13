"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  CircleUser,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/spectrumui/avatar";
import { Button } from "@/components/spectrumui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/spectrumui/dropdown-menu";
import { useLogout, useNotifications, useSession } from "@/lib/api/queries";
import { initials } from "@/lib/format";
import { findNavItem } from "@/lib/nav";
import { ROLE_LABELS } from "@logiflow/shared";
import { useUiStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { Can } from "@/components/shared/permission-gate";

/**
 * §11.1 Topbar: where am I, what needs attention, who am I. The search button
 * is the ⌘K palette — there is no separate search field anywhere in the app.
 */
export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: notifications } = useNotifications();
  const logout = useLogout();
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen);

  const current = findNavItem(pathname);
  const unread = (notifications?.data ?? []).filter((item) => !item.readAt).length;
  const role = session?.role;

  async function signOut() {
    await logout.mutateAsync();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-3.5 backdrop-blur-md sm:px-5">
      {/* Phone: the brand stands in for the sidebar. */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground"
        >
          {initials(session?.tenant.productName ?? "LogiFlow")}
        </span>
        <p className="truncate text-[14px] font-semibold">
          {current?.label ?? session?.tenant.productName ?? "LogiFlow"}
        </p>
      </div>

      {/* Desktop: current destination. */}
      <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
        <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">
          {current?.label ?? "LogiFlow"}
        </p>
        {current?.description && (
          <p className="hidden truncate text-[12.5px] text-muted-foreground xl:block">
            · {current.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "hidden h-8.5 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[12.5px] text-muted-foreground transition-colors duration-150 hover:border-ring/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex sm:w-[220px]",
          )}
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10.5px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          aria-label="Search"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="size-4" />
        </Button>

        <Can permission={["shipment:create"]} role={role} fallback={null}>
          <Button size="sm" className="hidden md:inline-flex" render={<Link href="/shipments/new" />}>
            <Plus className="size-3.5" />
            New shipment
          </Button>
        </Can>

        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          onClick={() => setNotificationsOpen(true)}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9.5px] leading-4 font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>

        <ThemeMenu />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account"
                className="flex items-center gap-2 rounded-lg p-0.5 transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            }
          >
            <Avatar className="size-7">
              {session?.user.avatarUrl ? (
                <AvatarImage src={session.user.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="bg-muted text-[11px] font-medium">
                {initials(session?.user.name ?? "?")}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium">{session?.user.name}</span>
              <span className="truncate text-[11.5px] font-normal text-muted-foreground">
                {session?.user.email}
              </span>
              {role && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {ROLE_LABELS[role]} · {session?.tenant.companyName}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <CircleUser className="size-3.5" />
              Your profile
            </DropdownMenuItem>
            <Can permission={["settings:manage"]} role={role} fallback={null}>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <SettingsIcon className="size-3.5" />
                Workspace settings
              </DropdownMenuItem>
            </Can>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={signOut} disabled={logout.isPending}>
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Theme"
            className="relative text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(theme === option.value && "text-foreground")}
          >
            <option.icon className="size-3.5" />
            {option.label}
            {theme === option.value && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
