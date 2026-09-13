"use client";

import { motion, easeOut } from "framer-motion";
import { Package } from "lucide-react";

import { LoginForm } from "@/components/features/auth/login-form";
import { SHOW_DEMO_HINTS } from "@/lib/env";

/**
 * §14.1 Login screen. Uses the logincard registry demo's visual language
 * (centered card, rounded corners, floating labels, brand header) but the
 * content is real. Demo accounts are shown when NEXT_PUBLIC_DEMO is set.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="w-full max-w-md"
      >
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          {/* Brand header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10">
              <Package className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-light text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          <LoginForm />

          {SHOW_DEMO_HINTS && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-2 text-center text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Demo accounts
              </p>
              <div className="space-y-1.5 text-[12px] text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Owner:</span>{" "}
                  priya@fivelogistics.in
                </p>
                <p>
                  <span className="font-medium text-foreground">Dispatcher:</span>{" "}
                  rahul@fivelogistics.in
                </p>
                <p className="mt-1 italic">Any password works in demo mode.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
