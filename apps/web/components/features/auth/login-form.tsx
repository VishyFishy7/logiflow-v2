"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { FloatingLabelInput } from "@/components/spectrumui/floating-label-input";
import { useLogin } from "@/lib/api/queries";

/**
 * §14.1 Login form. Uses the same visual language as the logincard registry
 * demo (rounded card, floating labels, submit button) but wired to the real
 * `/auth/login` endpoint via `useLogin`. Invalid credentials are shown inline;
 * no toast.
 */
export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          toast.success("Signed in");
          router.push("/dashboard");
        },
        onError: (err) => {
          // §14.1 — real errors shown inline, no toast.
          setError(err?.message || "Invalid email or password. Please try again.");
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-4">
        <FloatingLabelInput
          id="login-email"
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          disabled={login.isPending}
        />
        <FloatingLabelInput
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
          disabled={login.isPending}
        />
      </div>

      {error && (
        <p
          id="login-error"
          role="alert"
          className="rounded-lg bg-[var(--status-delayed-bg)] px-3 py-2 text-[13px] leading-relaxed text-[var(--status-delayed)]"
        >
          {error}
        </p>
      )}

      <LoadingButton
        type="submit"
        loading={login.isPending}
        disabled={login.isPending}
        className="w-full"
        size="lg"
      >
        {!login.isPending && <LogIn className="size-4" />}
        Sign in
      </LoadingButton>
    </form>
  );
}
