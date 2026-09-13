"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { PageHeader } from "@/components/shared/page-header";
import { CanSession } from "@/components/shared/permission-gate";
import { DataState, EmptyState, ErrorBlock, LoadingBlock } from "@/components/shared/data-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTeam, useUpdateMember } from "@/lib/api/queries";
import { InviteMemberDialog } from "@/components/features/team/invite-member-dialog";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@logiflow/shared";
import { ASSIGNABLE_ROLES } from "@logiflow/shared";
import { dateTime } from "@/lib/format";
import { initials } from "@/lib/format";
import type { UserDTO } from "@logiflow/contracts";

/**
 * §14.10 Team management — list, invite, role change, deactivate.
 * Gated on `team:manage` permission. Uses Data Table in `minimal`
 * configuration per §11.3.
 */
export default function TeamPage() {
  const { data, isPending, isError, error, refetch } = useTeam();
  const updateMember = useUpdateMember();
  const [inviteOpen, setInviteOpen] = useState(false);

  const members = data?.data ?? [];

  const handleRoleChange = (userId: string, newRole: Role, currentRole: Role) => {
    if (newRole === currentRole) return;
    updateMember.mutate(
      { id: userId, input: { role: newRole } },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (err) => toast.error(err?.message || "Failed to update role"),
      },
    );
  };

  const handleToggleActive = (userId: string, active: boolean) => {
    updateMember.mutate(
      { id: userId, input: { active: !active } },
      {
        onSuccess: () =>
          toast.success(active ? "Member deactivated" : "Member reactivated"),
        onError: (err) => toast.error(err?.message || "Failed to update member"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team"
        description="Members, roles and invitations."
        actions={
          <CanSession permission="team:manage">
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" />
              Invite member
            </Button>
          </CanSession>
        }
      />

      <DataState
        status={isPending ? "pending" : isError ? "error" : members.length > 0 ? "ready" : "empty"}
        skeleton={<LoadingBlock rows={5} label="Loading team" />}
        error={<ErrorBlock description={error?.message} onRetry={() => refetch()} />}
        empty={
          <EmptyState
            title="No team members"
            description="Invite your first team member to get started."
            icon={Users}
          />
        }
      >
        {/* Desktop table */}
        <div className="hidden rounded-2xl border border-border md:block">
          <div className="grid grid-cols-[1fr_1fr_140px_120px_100px] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Last login</span>
            <span className="text-right">Actions</span>
          </div>
          {members.map((member) => (
            <TeamRow
              key={member.id}
              member={member}
              onRoleChange={handleRoleChange}
              onToggleActive={handleToggleActive}
              isUpdating={updateMember.isPending}
            />
          ))}
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {members.map((member) => (
            <TeamCard
              key={member.id}
              member={member}
              onRoleChange={handleRoleChange}
              onToggleActive={handleToggleActive}
              isUpdating={updateMember.isPending}
            />
          ))}
        </div>
      </DataState>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function TeamRow({
  member,
  onRoleChange,
  onToggleActive,
  isUpdating,
}: {
  member: UserDTO;
  onRoleChange: (id: string, role: Role, current: Role) => void;
  onToggleActive: (id: string, active: boolean) => void;
  isUpdating: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_140px_120px_100px] items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
          {initials(member.name)}
        </div>
        <span className="truncate text-sm font-medium">{member.name}</span>
      </div>
      <span className="truncate text-[13px] text-muted-foreground">{member.email}</span>
      <select
        value={member.role}
        onChange={(e) => onRoleChange(member.id, e.target.value as Role, member.role)}
        disabled={isUpdating}
        className="h-7 rounded-md border border-border bg-transparent px-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
        aria-label={`Role for ${member.name}`}
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {member.lastLoginAt ? dateTime(member.lastLoginAt) : "Never"}
      </span>
      <div className="flex justify-end">
        <LoadingButton
          variant={member.active ? "ghost" : "outline"}
          size="sm"
          onClick={() => onToggleActive(member.id, member.active)}
          disabled={isUpdating}
        >
          {member.active ? "Deactivate" : "Reactivate"}
        </LoadingButton>
      </div>
    </div>
  );
}

function TeamCard({
  member,
  onRoleChange,
  onToggleActive,
  isUpdating,
}: {
  member: UserDTO;
  onRoleChange: (id: string, role: Role, current: Role) => void;
  onToggleActive: (id: string, active: boolean) => void;
  isUpdating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {initials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{member.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{member.email}</p>
        </div>
        <StatusBadge
          kind="sync"
          value={member.active ? "synced" : "failed"}
          size="sm"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Role
          </label>
          <select
            value={member.role}
            onChange={(e) => onRoleChange(member.id, e.target.value as Role, member.role)}
            disabled={isUpdating}
            className="h-7 w-full rounded-md border border-border bg-transparent px-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <LoadingButton
          variant="ghost"
          size="sm"
          onClick={() => onToggleActive(member.id, member.active)}
          disabled={isUpdating}
        >
          {member.active ? "Deactivate" : "Reactivate"}
        </LoadingButton>
      </div>
    </div>
  );
}
