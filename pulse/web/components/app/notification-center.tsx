"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ShieldAlert, Clock, BellRing, Check } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { buildNotifications } from "@/lib/notifications";
import { requestPushPermission, showLocalNotification, fcmConfigured } from "@/lib/firebase";
import { relativeTime, cn } from "@/lib/utils";

export function NotificationCenter() {
  const { tasksDerived, now } = useStore();
  const [open, setOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [pushState, setPushState] = React.useState<"idle" | "granted" | "denied">("idle");
  const ref = React.useRef<HTMLDivElement>(null);

  const notifications = React.useMemo(() => buildNotifications(tasksDerived, now), [tasksDerived, now]);
  const unread = notifications.filter((n) => !readIds.has(n.id)).length;

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function enablePush() {
    const res = await requestPushPermission();
    setPushState(res === "granted" ? "granted" : "denied");
    if (res === "granted" && notifications[0]) {
      showLocalNotification("Pulse notifications on", notifications[0].title);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-border text-muted transition hover:text-fg"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[9px] font-semibold text-white ring-2 ring-bg">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass-strong absolute right-0 top-12 z-50 w-80 rounded-2xl p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="font-display text-sm font-semibold text-fg">Notifications</p>
              {unread > 0 && (
                <button onClick={() => setReadIds(new Set(notifications.map((n) => n.id)))} className="text-[11px] text-brand hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 space-y-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-subtle">You&apos;re all caught up 🎉</p>
              ) : (
                notifications.map((n) => {
                  const read = readIds.has(n.id);
                  const Icon = n.kind === "risk" ? ShieldAlert : Clock;
                  return (
                    <Link
                      key={n.id}
                      href={n.taskId ? `/tasks?focus=${n.taskId}` : "/dashboard"}
                      onClick={() => { setReadIds((s) => new Set(s).add(n.id)); setOpen(false); }}
                      className={cn("flex items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-surface/60", !read && "bg-surface/40")}
                    >
                      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", n.kind === "risk" ? "bg-critical/12 text-critical" : "bg-medium/12 text-medium")}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-fg">{n.title}</p>
                        <p className="line-clamp-2 text-[11px] text-subtle">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-subtle">{relativeTime(n.at, now)}</p>
                      </div>
                      {!read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    </Link>
                  );
                })
              )}
            </div>

            <div className="mt-1 border-t border-border p-2">
              {pushState === "granted" ? (
                <p className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-success">
                  <Check className="h-3.5 w-3.5" /> Push notifications enabled{fcmConfigured() ? " (FCM)" : ""}
                </p>
              ) : (
                <button onClick={enablePush} className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface/60 py-2 text-xs font-medium text-fg transition hover:bg-surface-2">
                  <BellRing className="h-3.5 w-3.5 text-brand" />
                  {pushState === "denied" ? "Enable in browser settings" : "Enable push notifications"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
