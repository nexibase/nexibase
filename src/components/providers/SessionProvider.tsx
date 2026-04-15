"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}

// Called on successful login (currently unused, kept for backwards compatibility)
export function markBrowserSession() {
  // The proxy converts this to a session cookie, so no extra work is needed
}

// Called before initiating social login (currently unused, kept for backwards compatibility)
export function markJustLoggedIn() {
  // The proxy converts this to a session cookie, so no extra work is needed
}

// Called on logout (currently unused, kept for backwards compatibility)
export function clearBrowserSession() {
  // The proxy converts this to a session cookie, so no extra work is needed
}
