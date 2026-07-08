"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authMode } from "@/lib/auth";
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  const router = useRouter();
  const mode = authMode();
  const enter = () => router.push("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute left-1/2 top-1/3 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand/25 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/"><Logo /></Link>
          <div>
            <h1 className="max-w-md font-display text-4xl font-bold leading-tight text-fg">
              Your day, <span className="text-gradient">planned before you wake up.</span>
            </h1>
            <p className="mt-4 max-w-sm text-muted">
              Pulse prioritizes your work, predicts missed deadlines, and rebuilds
              your schedule the moment things change.
            </p>
            <div className="mt-8 flex items-center gap-3 text-xs text-subtle">
              <ShieldCheck className="h-4 w-4 text-low" />
              Your tasks and calendar stay private to you.
            </div>
          </div>
          <p className="text-xs text-subtle">© 2026 Pulse. Built for the last-minute life.</p>
        </div>
      </div>

      {/* Auth panel */}
      <div className="grid place-items-center p-6">
        {mode === "clerk" ? (
          <div className="w-full max-w-sm">
             <div className="mb-8 lg:hidden flex justify-center"><Logo /></div>
             <SignIn routing="hash" fallbackRedirectUrl="/dashboard" forceRedirectUrl="/dashboard" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm"
          >
            <div className="mb-8 lg:hidden"><Logo /></div>
            <h2 className="font-display text-2xl font-semibold text-fg">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">Sign in to your Chief of Staff.</p>

            <div className="mt-6 space-y-2.5">
              <button onClick={enter} className="glass flex w-full items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-medium text-fg transition hover:bg-surface-2">
                <GoogleIcon /> Continue with Google
              </button>
              <button onClick={enter} className="glass flex w-full items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-medium text-fg transition hover:bg-surface-2">
                <GithubIcon /> Continue with GitHub
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); enter(); }} className="space-y-2.5">
              <Input type="email" placeholder="you@email.com" required />
              <Button type="submit" className="w-full" size="lg">
                Continue with email <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-subtle">
              Demo mode — any input opens the app. Add a Clerk key to enable real auth.
            </p>
            <p className="mt-2 text-center text-xs text-subtle">
              New here?{" "}
              <button onClick={enter} className="text-brand hover:underline">Create an account</button>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg className="h-4 w-4 fill-fg" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
