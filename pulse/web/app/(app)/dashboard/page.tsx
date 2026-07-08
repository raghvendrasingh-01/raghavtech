"use client";

import { DailyBriefing } from "@/components/dashboard/daily-briefing";
import { DeadlineRadar } from "@/components/dashboard/deadline-radar";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { UrgentTasks } from "@/components/dashboard/urgent-tasks";
import { ProductivityCard } from "@/components/dashboard/productivity-card";
import { AiSuggestions } from "@/components/dashboard/ai-suggestions";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CalendarPreview } from "@/components/dashboard/calendar-preview";

/**
 * The AI Dashboard — every widget is wired to the live intelligence engine
 * via the demo store, so priorities, risk and the schedule update as state
 * changes.
 */
export default function DashboardPage() {
  return (
    <div className="pb-6">
      <DailyBriefing />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 xl:col-span-2">
          <DeadlineRadar />
          <TodaySchedule />
          <UrgentTasks />
          <RecentActivity />
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <ProductivityCard />
          <AiSuggestions />
          <UpcomingDeadlines />
          <CalendarPreview />
        </div>
      </div>
    </div>
  );
}
