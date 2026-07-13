"use client";

import { useState, type ReactNode } from "react";

import { AuthForm } from "@/components/auth-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Wraps any trigger in a modal sign-in / sign-up form. On success the server
 * action redirects to /dashboard, which navigates away and closes the dialog.
 */
export function AuthDialog({
  defaultMode = "signin",
  children,
}: {
  defaultMode?: "signin" | "signup";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Welcome to Sev</DialogTitle>
          <DialogDescription>Your user-owned AI memory layer.</DialogDescription>
        </DialogHeader>
        <AuthForm defaultMode={defaultMode} />
      </DialogContent>
    </Dialog>
  );
}
