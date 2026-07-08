/**
 * Auth seam. Pulse ships with a demo user so the whole app is usable with zero
 * setup. When a Clerk publishable key is present, swap `AuthProvider` to wrap
 * Clerk's `<ClerkProvider>` and read the real session — the `useAuth()` shape
 * below is intentionally Clerk-compatible.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
}

export const DEMO_USER: AuthUser = {
  id: "demo-user",
  name: "Raghvendra Singh",
  email: "raghvendra@pulse.app",
  initials: "RS",
};

export function authMode(): "clerk" | "demo" {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "clerk" : "demo";
}
