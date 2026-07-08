"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, BrainCircuit, Clock, CalendarClock, ListTree, ShieldAlert, Check, X, FilePlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { useStore } from "@/components/providers/demo-store";
import { analyzeTask, type TaskDraft } from "@/lib/intelligence";
import type { Category, Difficulty, Task, Subtask } from "@/lib/types";
import { formatDuration, cn } from "@/lib/utils";
import { SubtaskEditor } from "./subtask-editor";
import { useAuth } from "@/components/providers/auth-provider";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export function TaskEditDialog({ task, open, onClose }: { task: Task; open: boolean; onClose: () => void }) {
  const { updateTask, events, now, settings } = useStore();
  const user = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description || "");
  const [category, setCategory] = React.useState<Category>(task.category);
  const [difficulty, setDifficulty] = React.useState<Difficulty>(task.difficulty);
  const [estimate, setEstimate] = React.useState(task.estimateMin);
  // Remove trailing Z if present, ensure local time format YYYY-MM-DDTHH:mm
  const initialDeadline = task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "";
  const [deadline, setDeadline] = React.useState(initialDeadline);
  const [deadlineMode, setDeadlineMode] = React.useState<"date" | "period">("date");
  const [periodValue, setPeriodValue] = React.useState(3);
  const [periodUnit, setPeriodUnit] = React.useState<"days" | "weeks" | "months">("days");
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [editedSubtasks, setEditedSubtasks] = React.useState<Subtask[]>(task.subtasks);

  const [existingAttachments, setExistingAttachments] = React.useState<string[]>(task.attachments || []);
  const [newFiles, setNewFiles] = React.useState<File[]>([]);
  const [isGeneratingDesc, setIsGeneratingDesc] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [llmAnalysis, setLlmAnalysis] = React.useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  // Reset when opened.
  React.useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description || "");
      setCategory(task.category);
      setDifficulty(task.difficulty);
      setEstimate(task.estimateMin);
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "");
      setDeadlineMode("date");
      setPeriodValue(3);
      setPeriodUnit("days");
      setExcluded(new Set());
      setEditedSubtasks(task.subtasks);
      setExistingAttachments(task.attachments || []);
      setNewFiles([]);
      setIsGeneratingDesc(false);
      setIsUploading(false);
      setUploadError(null);
      setLlmAnalysis(null);
      setIsAnalyzing(false);
    }
  }, [open, task]);

  const computedDeadline = React.useMemo(() => {
    if (deadlineMode === "date") {
      return deadline ? new Date(deadline).toISOString() : "";
    } else {
      const d = new Date(now);
      if (periodUnit === "days") d.setDate(d.getDate() + periodValue);
      if (periodUnit === "weeks") d.setDate(d.getDate() + periodValue * 7);
      if (periodUnit === "months") d.setMonth(d.getMonth() + periodValue);
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }
  }, [deadlineMode, deadline, periodValue, periodUnit, now]);

  const draft: TaskDraft = {
    title,
    description,
    category,
    difficulty,
    estimateMin: estimate,
    deadline: computedDeadline,
  };

  const ready = title.trim().length > 1 && !!computedDeadline;
  const analysis = React.useMemo(
    () => (ready ? analyzeTask(draft, { events, now }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, title, description, category, difficulty, estimate, deadline]
  );

  function toggleSub(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generateDescription() {
    if (!title.trim()) return;
    setIsGeneratingDesc(true);
    try {
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          subtasks: editedSubtasks.map(s => s.title)
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.description) setDescription(data.description);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingDesc(false);
    }
  }

  async function analyzeWithAI() {
    if (!ready) return;
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("difficulty", difficulty);
      formData.append("deadline", computedDeadline);
      formData.append("estimate", estimate.toString());
      formData.append("manualSubtasks", JSON.stringify(editedSubtasks.map(s => ({ title: s.title }))));
      newFiles.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subtasks) {
          data.subtasks = data.subtasks.map((s: any, i: number) => ({ ...s, id: `sub-${i}-${Date.now()}` }));
        }
        setLlmAnalysis(data);
        setExcluded(new Set());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function uploadAttachments(): Promise<string[]> {
    if (newFiles.length === 0) return [];
    if (!API_URL) throw new Error("File storage isn't configured.");

    const form = new FormData();
    newFiles.forEach((file) => form.append("files", file));

    const res = await fetch(`${API_URL}/storage/task-attachments`, {
      method: "POST",
      headers: { "X-User-Id": user.id },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || `Upload failed (${res.status})`);
    }
    const data = await res.json();
    return (data.urls as string[]) ?? [];
  }

  async function handleSave() {
    if (isUploading) return;
    
    let uploadedUrls: string[] = [];
    try {
      setUploadError(null);
      setIsUploading(true);
      uploadedUrls = await uploadAttachments();
    } catch (e: any) {
      console.error("Attachment upload failed:", e);
      setUploadError(e?.message || "Upload failed. Please try again.");
      setIsUploading(false);
      return;
    }

    // Merge existing/edited subtasks with any new suggested ones not excluded
    const existingIds = new Set(editedSubtasks.map(s => s.id));
    const newSubtasks = llmAnalysis?.subtasks?.filter((s: Subtask) => !excluded.has(s.id) && !existingIds.has(s.id)) || [];
    
    const finalAttachments = [...existingAttachments, ...uploadedUrls];

    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      difficulty,
      estimateMin: estimate,
      deadline: computedDeadline,
      subtasks: [...editedSubtasks, ...newSubtasks],
      attachments: finalAttachments.length ? finalAttachments : undefined,
    });
    setIsUploading(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <div className="mb-5 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-3">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Edit task</h2>
          <p className="text-xs text-subtle">Pulse updates analysis as you edit.</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        {/* form */}
        <div className="space-y-3">
          <Field label="Task name">
            <Input autoFocus placeholder="e.g. Finish DS Assignment 3" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field 
            label={
              <div className="flex items-center justify-between w-full">
                <span>Description</span>
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={!title.trim() || isGeneratingDesc}
                  className="flex items-center gap-1 text-[10px] text-brand hover:text-brand-4 disabled:opacity-50 transition"
                >
                  <Sparkles className="h-3 w-3" />
                  {isGeneratingDesc ? "Generating..." : "AI Generate"}
                </button>
              </div>
            }
            hint="Optional — helps Pulse break it down."
          >
            <Textarea placeholder="What needs to happen?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {settings.categories.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field 
              label={
                <div className="flex items-center justify-between w-full">
                  <span>Deadline</span>
                  <button type="button" onClick={() => setDeadlineMode(m => m === 'date' ? 'period' : 'date')} className="text-[10px] font-medium text-brand hover:underline">
                    {deadlineMode === 'date' ? 'Set Period' : 'Set Date'}
                  </button>
                </div>
              }
            >
              {deadlineMode === "date" ? (
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full"
                />
              ) : (
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    min={1} 
                    value={periodValue} 
                    onChange={(e) => setPeriodValue(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-16" 
                  />
                  <Select value={periodUnit} onChange={(e) => setPeriodUnit(e.target.value as any)} className="flex-1">
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </Select>
                </div>
              )}
            </Field>
          </div>
          <Field label="Difficulty">
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-xl border py-2 text-xs font-medium capitalize transition",
                    difficulty === d ? "border-brand/50 bg-brand/15 text-brand" : "border-border text-muted hover:text-fg"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Your estimate — ${formatDuration(estimate)}`}>
            <input
              type="range"
              min={15}
              max={480}
              step={15}
              value={estimate}
              onChange={(e) => setEstimate(Number(e.target.value))}
              className="w-full accent-[var(--color-brand)]"
            />
          </Field>
          
          <Field label="Attachments">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/30 p-4 text-xs text-subtle transition hover:bg-surface/50">
                <FilePlus className="h-4 w-4" />
                <span>Upload PDF or Images</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
              </label>

              {(existingAttachments.length > 0 || newFiles.length > 0) && (
                <div className="space-y-1.5">
                  {existingAttachments.map((url, i) => (
                    <div key={`exist-${i}`} className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-2.5 py-1.5 text-xs">
                      <span className="truncate text-fg">{url.split('/').pop() || 'Attachment'}</span>
                      <button
                        onClick={() => setExistingAttachments((prev) => prev.filter((u) => u !== url))}
                        className="text-subtle hover:text-critical"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {newFiles.map((file, i) => (
                    <div key={`new-${i}`} className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-2.5 py-1.5 text-xs">
                      <span className="truncate text-fg">{file.name}</span>
                      <button
                        onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-subtle hover:text-critical"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>
          
          <Field label="Subtasks">
            <SubtaskEditor subtasks={editedSubtasks} onChange={setEditedSubtasks} />
          </Field>
        </div>

        {/* LLM analysis */}
        <div className="rounded-2xl border border-border bg-bg/40 p-4 flex flex-col">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-brand">
            <div className="flex items-center gap-1.5">
              <BrainCircuit className="h-3.5 w-3.5" /> AI Analysis
            </div>
            {!llmAnalysis && ready && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={analyzeWithAI} disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Analyze"}
              </Button>
            )}
          </div>

          {!llmAnalysis ? (
            <div className="grid flex-1 min-h-52 place-items-center text-center">
              <p className="max-w-[14rem] text-sm text-subtle">
                {isAnalyzing ? "Analyzing task..." : "Click Analyze to get AI insights and subtasks."}
              </p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-sm">
              {analysis && (
                <>
                  <div className="flex items-center gap-4">
                    <RadialGauge value={analysis.risk.risk} size={92} stroke={9} sublabel="risk" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={analysis.priority.priority}>{analysis.priority.priority}</Badge>
                        <span className="text-xs text-subtle">priority</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-snug text-muted">{analysis.priority.reason}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Insight icon={Clock} label="Realistic time">
                      {formatDuration(analysis.adjustedEstimateMin)}
                      {analysis.estimateDeltaPct > 0 && (
                        <span className="ml-1 text-high">+{analysis.estimateDeltaPct}%</span>
                      )}
                    </Insight>
                    <Insight icon={CalendarClock} label="Best time">
                      {analysis.bestSlot ? analysis.bestSlot.label.replace(" — your best window for this", "") : "No free slot"}
                    </Insight>
                  </div>
                </>
              )}

              <div className="space-y-2 pt-2 border-t border-border">
                <div>
                  <span className="font-semibold text-fg">Complexity: </span>
                  <span className="text-subtle">{llmAnalysis.complexity}</span>
                </div>
                {llmAnalysis.risks && llmAnalysis.risks.toLowerCase() !== "none" && (
                  <div className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/8 px-3 py-2 text-xs text-critical">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{llmAnalysis.risks}</span>
                  </div>
                )}
                {llmAnalysis.missingInfo && llmAnalysis.missingInfo.toLowerCase() !== "none" && (
                  <div>
                    <span className="font-semibold text-fg">Missing Info: </span>
                    <span className="text-subtle">{llmAnalysis.missingInfo}</span>
                  </div>
                )}
                <div className="rounded-lg bg-brand/10 p-2.5 text-xs text-brand-text">
                  <span className="font-semibold">Tip: </span>{llmAnalysis.recommendation}
                </div>
              </div>

              {llmAnalysis.subtasks?.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ListTree className="h-3.5 w-3.5" /> Suggested subtasks
                  </div>
                  <div className="space-y-1">
                    {llmAnalysis.subtasks.map((s: Subtask) => {
                      const on = !excluded.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleSub(s.id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface/40 px-2.5 py-1.5 text-left text-xs transition hover:border-border-strong"
                        >
                          <span
                            className={cn(
                              "grid h-4 w-4 shrink-0 place-items-center rounded border",
                              on ? "border-brand bg-brand text-white" : "border-border-strong text-transparent"
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span className={cn("flex-1 truncate", on ? "text-fg" : "text-subtle line-through")}>{s.title}</span>
                          <span className="text-subtle">{formatDuration(s.estimateMin)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <div className="text-xs text-critical">{uploadError}</div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!ready || isUploading}>
            <Sparkles className="h-4 w-4" /> {isUploading ? "Uploading..." : "Save changes"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Insight({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-subtle">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 font-medium text-fg">{children}</div>
    </div>
  );
}
