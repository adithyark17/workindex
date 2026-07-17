"use client";

import { SignInButton, useAuth, UserButton } from "@clerk/nextjs";

export function AuthControls() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <span aria-label="Loading account" />;
  return (
    <div className="auth-controls">
      {isSignedIn ? <UserButton /> : <SignInButton mode="modal"><button type="button">Sign in</button></SignInButton>}
    </div>
  );
}
