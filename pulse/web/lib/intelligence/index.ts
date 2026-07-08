/** Pulse local intelligence engine — the always-on "AI". */
export { computePriority, workRemainingMin } from "./priority";
export type { PriorityContext } from "./priority";
export { computeRisk, freeMinutesBefore } from "./risk";
export type { RiskContext } from "./risk";
export { generateSchedule, generateRange } from "./scheduler";
export type { ScheduleOptions, ScheduleResult, RangeResult } from "./scheduler";
export { planFromMessage } from "./planner";
export type { PlannerInput, PlannerOutput } from "./planner";
export {
  computeProductivityScore,
  detectOverload,
  generateSuggestions,
  generateBriefing,
} from "./insights";
export {
  analyzeTask,
  adjustEstimate,
  suggestSubtasks,
  suggestBestSlot,
  suggestMilestones,
} from "./breakdown";
export type { TaskDraft, TaskAnalysis } from "./breakdown";
