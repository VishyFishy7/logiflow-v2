"use client";

import type { ReactNode } from "react";

import { can, type Permission, type Role } from "@logiflow/shared";

import { useSession } from "@/lib/api/queries";

import { useIsMobile } from "./responsive-overlay";

/**
 * §7.4 The UI hides what the API would refuse. This is a presentation
 * convenience only — every one of these permissions is enforced again on the
 * server (and in the MSW handlers), so hiding a button is never the control.
 */
export function Can({
  permission,
  role,
  fallback = null,
  children,
}: {
  permission: Permission | Permission[];
  role: Role | undefined;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (!role) return <>{fallback}</>;
  const list = Array.isArray(permission) ? permission : [permission];
  return <>{list.some((entry) => can(role, entry)) ? children : fallback}</>;
}

/** Same gate, reading the role from the session query. */
export function CanSession({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission | Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { data } = useSession();
  return (
    <Can permission={permission} role={data?.role} fallback={fallback}>
      {children}
    </Can>
  );
}

/** `const allowed = useCan("invoice:manage")` for logic, not just markup. */
export function useCan(permission: Permission | Permission[]): boolean {
  const { data } = useSession();
  if (!data) return false;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((entry) => can(data.role, entry));
}

export { useIsMobile };
