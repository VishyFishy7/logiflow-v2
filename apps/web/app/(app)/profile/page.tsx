"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Save, KeyRound } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import { PageHeader, SectionCard, DetailField } from "@/components/shared/page-header";
import { DataState } from "@/components/shared/data-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession, useUpdateProfile, useChangePassword } from "@/lib/api/queries";
import { ROLE_LABELS } from "@logiflow/shared";
import { date } from "@/lib/format";

/**
 * §14.11 Profile page — session user with role and tenant, name/email
 * update and password change. Not gated on `settings:manage` — every
 * logged-in user can view and edit their own profile.
 */
export default function ProfilePage() {
  const { data: session, isPending, isError, refetch } = useSession();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // Profile form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileInit, setProfileInit] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const user = session?.user;
  const tenant = session?.tenant;

  // Initialize profile form from session
  if (user && !profileInit) {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setProfileInit(true);
  }

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { name: name.trim(), email: email.trim(), phone: phone.trim() || null },
      {
        onSuccess: () => toast.success("Profile updated"),
        onError: (err) => toast.error(err?.message || "Failed to update profile"),
      },
    );
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success("Password changed");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => {
          setPasswordError(err?.message || "Failed to change password");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Your profile"
        description="Name, phone, password and session details."
      />

      <DataState
        status={isPending ? "pending" : isError ? "error" : user ? "ready" : "empty"}
        skeleton={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}
        error={
          <p className="text-sm text-muted-foreground">
            Could not load profile.{" "}
            <button onClick={() => refetch()} className="underline hover:text-foreground">
              Retry
            </button>
          </p>
        }
        empty={<p className="text-sm text-muted-foreground">No profile data.</p>}
      >
        <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:space-y-0">
          {/* Left — editable profile + password */}
          <div className="space-y-6">
            {/* Profile edit */}
            <form onSubmit={handleProfileSubmit}>
              <SectionCard title="Profile" description="Your name, email and phone number.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">Name</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={updateProfile.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={updateProfile.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      disabled={updateProfile.isPending}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <LoadingButton type="submit" loading={updateProfile.isPending}>
                    <Save className="size-4" />
                    Save profile
                  </LoadingButton>
                </div>
              </SectionCard>
            </form>

            {/* Password change */}
            <form onSubmit={handlePasswordSubmit}>
              <SectionCard title="Change password" description="Update your account password.">
                {passwordError && (
                  <p role="alert" className="mb-4 rounded-lg bg-[var(--status-delayed-bg)] px-3 py-2 text-[13px] text-[var(--status-delayed)]">
                    {passwordError}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-current">Current password</Label>
                    <Input
                      id="pw-current"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      disabled={changePassword.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-new">New password</Label>
                    <Input
                      id="pw-new"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      disabled={changePassword.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-confirm">Confirm new password</Label>
                    <Input
                      id="pw-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      required
                      disabled={changePassword.isPending}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <LoadingButton type="submit" loading={changePassword.isPending}>
                    <KeyRound className="size-4" />
                    Change password
                  </LoadingButton>
                </div>
              </SectionCard>
            </form>
          </div>

          {/* Right — read-only facts rail */}
          <div className="space-y-6">
            <SectionCard title="Account">
              <dl className="space-y-4">
                <DetailField label="Role">
                  <StatusBadge
                    kind="severity"
                    value="info"
                    size="sm"
                  />
                  <span className="ml-2 text-sm">{session?.role ? ROLE_LABELS[session.role] : "—"}</span>
                </DetailField>
                <DetailField label="Tenant">
                  <span className="text-sm">{tenant?.companyName ?? "—"}</span>
                </DetailField>
                <DetailField label="Plan">
                  <span className="capitalize text-sm">{tenant?.plan ?? "—"}</span>
                </DetailField>
                <DetailField label="Member since">
                  <span className="text-sm tabular-nums">{user ? date(user.createdAt) : "—"}</span>
                </DetailField>
                <DetailField label="Last login">
                  <span className="text-sm tabular-nums">{user?.lastLoginAt ? date(user.lastLoginAt) : "Never"}</span>
                </DetailField>
              </dl>
            </SectionCard>
          </div>
        </div>
      </DataState>
    </div>
  );
}
