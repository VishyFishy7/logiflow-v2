import {
  BarChart3,
  Building2,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { can, type Permission, type Role } from "@logiflow/shared";

/**
 * §11 Information architecture — one source for the sidebar, the mobile tab
 * bar, the ⌘K palette and the page headers, so a screen can never appear in
 * one place and be missing in another.
 *
 * `permission` is an any-of list: the item shows when the role holds at least
 * one of them (§7). Items with no permission are visible to every signed-in
 * role.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the phone tab bar. */
  short?: string;
  icon: LucideIcon;
  description: string;
  permission?: Permission[];
}

export interface NavGroup {
  id: "operations" | "business" | "admin";
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Today's volume, exceptions and cash position",
      },
      {
        href: "/shipments",
        label: "Shipments",
        short: "Shipments",
        icon: Package,
        description: "Every shipment, checkpoint and carrier booking",
        permission: ["shipment:read_all", "shipment:read_assigned"],
      },
      {
        href: "/leads",
        label: "Leads",
        short: "Leads",
        icon: Target,
        description: "Sales pipeline and conversion into clients",
        permission: ["lead:read_all", "lead:read_assigned"],
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        description: "Volume, service level and revenue trends",
        permission: ["analytics:view"],
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      {
        href: "/clients",
        label: "Clients",
        icon: Building2,
        description: "Accounts, credit terms and outstanding balances",
        permission: ["client:read"],
      },
      {
        href: "/carriers",
        label: "Carriers",
        icon: Truck,
        description: "Carrier adapters, priorities and webhook secrets",
        permission: ["carrier:manage"],
      },
      {
        href: "/invoices",
        label: "Invoices",
        icon: Receipt,
        description: "Billing, payment status and GST",
        permission: ["invoice:read"],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        href: "/audit",
        label: "Audit log",
        icon: ShieldCheck,
        description: "Every privileged action, append-only",
        permission: ["audit:read"],
      },
      {
        href: "/team",
        label: "Team",
        icon: Users,
        description: "Members, roles and invitations",
        permission: ["team:manage"],
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        description: "White-label branding, tracking and vocabulary",
        permission: ["settings:manage"],
      },
    ],
  },
];

/** Phone tab bar: the four destinations an ops user reaches for most (§13.2). */
export const MOBILE_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/shipments", label: "Shipments", icon: Package },
  { href: "/leads", label: "Leads", icon: Target },
] as const;

function allowed(item: NavItem, role: Role): boolean {
  if (!item.permission?.length) return true;
  return item.permission.some((permission) => can(role, permission));
}

/** Groups with items the role cannot see removed; empty groups dropped. */
export function visibleNav(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed(item, role)),
  })).filter((group) => group.items.length > 0);
}

/** The nav item that owns a pathname, longest match first (`/shipments/123`). */
export function findNavItem(pathname: string): NavItem | undefined {
  const all = NAV_GROUPS.flatMap((group) => group.items);
  return all
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Extra screens that are reachable but not primary nav destinations. */
export const SECONDARY_SCREENS = [
  { href: "/profile", label: "Your profile", description: "Name, phone, password and session" },
  { href: "/track", label: "Public tracking", description: "What a customer sees for one tracking ID" },
] as const;
