"use client";

import * as React from "react";
import { CalendarCheck, Bell, Clock, BrainCircuit, User, Check, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/demo-store";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const user = useAuth();
  const [notifs, setNotifs] = React.useState(false);
  const [prefs, setPrefs] = React.useState({
    smartReminders: true,
    dailyBriefing: true,
    weeklyReview: true,
    deadlineAlerts: true,
    energyAware: true,
    autoReschedule: true,
  });
  const [aggro, setAggro] = React.useState("balanced");
  
  const { settings, updateSettings, syncCalendar, syncGoogleTasks } = useStore();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isTasksSyncing, setIsTasksSyncing] = React.useState(false);

  const calConnected = settings.calConnected;
  const tasksConnected = settings.tasksConnected;

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-fg">Settings</h2>
        <p className="text-xs text-subtle">Tune how Pulse plans and nudges you.</p>
      </div>

      {/* Profile */}
      <Section icon={User} title="Profile">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-lg font-semibold text-white">{user.initials}</div>
          <div className="flex-1">
            <p className="font-medium text-fg">{user.name}</p>
            <p className="text-xs text-subtle">{user.email}</p>
          </div>
          <Button size="sm" variant="outline">Edit</Button>
        </div>
      </Section>

      {/* Integrations */}
      <Section icon={CalendarCheck} title="Integrations">
        <Row
          title="Google Calendar"
          desc={calConnected ? "Connected — Pulse schedules around your events." : "Sync meetings, classes and events."}
        >
          <Button 
            size="sm" 
            variant={calConnected ? "secondary" : "primary"} 
            disabled={isSyncing}
            onClick={async () => {
              if (calConnected) {
                updateSettings({ calConnected: false });
              } else {
                setIsSyncing(true);
                await syncCalendar();
                updateSettings({ calConnected: true });
                setIsSyncing(false);
              }
            }}
          >
            {isSyncing ? "Syncing..." : calConnected ? <><Check className="h-4 w-4" /> Connected</> : "Connect"}
          </Button>
        </Row>
        <Row
          title="Google Tasks"
          desc={tasksConnected ? "Connected — Synced with your Google Tasks." : "Import your Google Tasks."}
        >
          <Button 
            size="sm" 
            variant={tasksConnected ? "secondary" : "primary"} 
            disabled={isTasksSyncing}
            onClick={async () => {
              if (tasksConnected) {
                updateSettings({ tasksConnected: false });
              } else {
                setIsTasksSyncing(true);
                await syncGoogleTasks();
                updateSettings({ tasksConnected: true });
                setIsTasksSyncing(false);
              }
            }}
          >
            {isTasksSyncing ? "Syncing..." : tasksConnected ? <><Check className="h-4 w-4" /> Connected</> : "Connect"}
          </Button>
        </Row>
        <Row title="Push notifications" desc="Get Pulse nudges on your devices (Firebase Cloud Messaging).">
          <Button size="sm" variant={notifs ? "secondary" : "primary"} onClick={() => setNotifs((n) => !n)}>
            {notifs ? <><Check className="h-4 w-4" /> Enabled</> : "Enable"}
          </Button>
        </Row>
      </Section>

      {/* Working hours */}
      <Section icon={Clock} title="Working hours">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            <span className="mb-1.5 block text-xs">Day starts</span>
            <Select value={settings.dayStartHour.toString()} onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 5).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-muted">
            <span className="mb-1.5 block text-xs">Day ends</span>
            <Select value={settings.dayEndHour.toString()} onChange={(e) => updateSettings({ dayEndHour: Number(e.target.value) })}>
              {Array.from({ length: 8 }, (_, i) => i + 17).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </Select>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-subtle">Pulse only schedules focus blocks inside these hours.</p>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notifications">
        <ToggleRow label="Smart reminders" desc="Context-aware nudges, not just “due tomorrow”." checked={prefs.smartReminders} onChange={() => toggle("smartReminders")} />
        <ToggleRow label="Daily briefing" desc="A morning summary of your day." checked={prefs.dailyBriefing} onChange={() => toggle("dailyBriefing")} />
        <ToggleRow label="Weekly review" desc="Sunday recap + next week's plan." checked={prefs.weeklyReview} onChange={() => toggle("weeklyReview")} />
        <ToggleRow label="Deadline risk alerts" desc="Warn me when a deadline hits high risk." checked={prefs.deadlineAlerts} onChange={() => toggle("deadlineAlerts")} />
      </Section>

      {/* AI preferences */}
      <Section icon={BrainCircuit} title="AI planning">
        <label className="mb-3 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted"><Zap className="h-3.5 w-3.5" /> Planning style</span>
          <Select value={aggro} onChange={(e) => setAggro(e.target.value)}>
            <option value="relaxed">Relaxed — more buffers & breaks</option>
            <option value="balanced">Balanced — the default</option>
            <option value="aggressive">Aggressive — pack the day, hit deadlines</option>
          </Select>
        </label>
        <ToggleRow label="Energy-aware scheduling" desc="Put hard tasks in your peak-focus windows." checked={prefs.energyAware} onChange={() => toggle("energyAware")} />
        <ToggleRow label="Auto-reschedule" desc="Let Pulse move slipped tasks automatically." checked={prefs.autoReschedule} onChange={() => toggle("autoReschedule")} />
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="glass card-sheen rounded-3xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand" />
        <h3 className="font-display text-sm font-semibold text-fg">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs text-subtle">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors", checked ? "border-border-strong bg-surface/50" : "border-border bg-surface/30")}>
      <div className="flex-1">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-subtle">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}
