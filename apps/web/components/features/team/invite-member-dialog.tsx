"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import {
  ResponsiveOverlay,
  type ResponsiveOverlayProps,
} from "@/components/shared/responsive-overlay";
import { useInviteMember } from "@/lib/api/queries";
import { ROLE_LABELS, type Role } from "@logiflow/shared";
import { ASSIGNABLE_ROLES } from "@logiflow/shared";

/**
 * §14.10 Invite flow — opens as a ResponsiveOverlay (dialog on desktop,
 * bottom sheet on mobile). Email + role → invite token.
 */
export function InviteMemberDialog(props: Omit<ResponsiveOverlayProps, "title" | "children" | "footer">) {
  const invite = useInviteMember();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("dispatcher");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !name.trim()) {
      setError("Please enter name and email.");
      return;
    }

    invite.mutate(
      { email: email.trim(), name: name.trim(), role },
      {
        onSuccess: () => {
          toast.success(`Invite sent to ${email.trim()}`);
          setEmail("");
          setName("");
          setRole("dispatcher");
          props.onOpenChange(false);
        },
        onError: (err) => {
          setError(err?.message || "Failed to send invite");
        },
      },
    );
  };

  return (
    <ResponsiveOverlay
      {...props}
      title="Invite team member"
      description="Send an email invitation with a role assignment."
      footer={
        <>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)} disabled={invite.isPending}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="invite-form" loading={invite.isPending}>
            <UserPlus className="size-4" />
            Send invite
          </LoadingButton>
        </>
      }
    >
      <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-[var(--status-delayed-bg)] px-3 py-2 text-[13px] text-[var(--status-delayed)]">
            {error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">Full name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rahul Sharma"
            required
            disabled={invite.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="rahul@example.com"
            required
            disabled={invite.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={invite.isPending}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </form>
    </ResponsiveOverlay>
  );
}
