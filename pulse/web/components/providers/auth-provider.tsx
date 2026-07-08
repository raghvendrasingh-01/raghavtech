"use client";

import * as React from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import { DEMO_USER, type AuthUser, authMode } from "@/lib/auth";

const AuthContext = React.createContext<AuthUser>(DEMO_USER);

/** Returns a Clerk session-token getter (or null in demo mode). */
type TokenGetter = () => Promise<string | null>;
const TokenContext = React.createContext<TokenGetter | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode = authMode();
  if (mode === "clerk") {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  }
  return <AuthContext.Provider value={DEMO_USER}>{children}</AuthContext.Provider>;
}

function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { getToken } = useClerkAuth();

  const authUser: AuthUser = React.useMemo(() => {
    if (!isLoaded || !user) return DEMO_USER;
    return {
      id: user.id,
      name: user.fullName || user.firstName || "User",
      email: user.primaryEmailAddress?.emailAddress || "",
      initials: (user.firstName?.[0] || "U") + (user.lastName?.[0] || ""),
      avatarUrl: user.imageUrl,
    };
  }, [user, isLoaded]);

  const tokenGetter = React.useCallback<TokenGetter>(() => getToken(), [getToken]);

  return (
    <TokenContext.Provider value={tokenGetter}>
      <AuthContext.Provider value={authUser}>{children}</AuthContext.Provider>
    </TokenContext.Provider>
  );
}

export function useAuth(): AuthUser {
  return React.useContext(AuthContext);
}

/**
 * Returns a function that yields the current Clerk session token as a Bearer
 * string for API calls, or null in demo mode (backend then falls back to
 * X-User-Id / demo). Use in fetch: `Authorization: Bearer <token>`.
 */
export function useAuthToken(): TokenGetter {
  const getter = React.useContext(TokenContext);
  return React.useCallback(() => (getter ? getter() : Promise.resolve(null)), [getter]);
}
