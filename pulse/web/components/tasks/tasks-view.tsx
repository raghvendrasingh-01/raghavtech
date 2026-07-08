"use client";

import * as React from "react";
import { Plus, LayoutGrid, List, Filter } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TaskCreateDialog } from "./task-create-dialog";
import { PRIORITY_LABEL } from "@/lib/ui-maps";
import type { Category, Priority, TaskWithIntel } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const PRIORITY_ACCENT: Record<Priority, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
};

// --- DND Wrappers ---

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("space-y-2.5 rounded-2xl transition-colors", isOver && "bg-surface/50 ring-1 ring-brand/30")}>
      {children}
    </div>
  );
}

function DraggableTask({ task, defaultOpen }: { task: TaskWithIntel; defaultOpen?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative touch-none">
      <div 
        className="absolute -left-2 top-0 bottom-0 w-6 cursor-grab z-10 hover:bg-border/20 rounded-l-2xl"
        {...attributes} 
        {...listeners} 
      />
      <TaskCard task={task} defaultOpen={defaultOpen} />
    </div>
  );
}

// --- Main View ---

export function TasksView() {
  const { tasksDerived, updateTask, settings } = useStore();
  const [view, setView] = React.useState<"board" | "list">("board");
  const [cat, setCat] = React.useState<Category | "all">("all");
  const [showDone, setShowDone] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [focusId, setFocusId] = React.useState<string | null>(null);

  const [activeTask, setActiveTask] = React.useState<TaskWithIntel | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("new")) setDialogOpen(true);
    if (p.get("focus")) setFocusId(p.get("focus"));
  }, []);

  const filtered = tasksDerived.filter((t) => (cat === "all" ? true : t.category === cat));
  const open = filtered.filter((t) => t.status !== "done");
  const doneList = filtered.filter((t) => t.status === "done");

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = open.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (over && over.id) {
      const targetPriority = over.id as Priority;
      const task = open.find((t) => t.id === active.id);
      
      // If dropped in a different priority column, manually override it
      if (task && task.priorityResult.priority !== targetPriority) {
        updateTask(task.id, { manualPriority: targetPriority });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-fg">Tasks</h2>
          <p className="text-xs text-subtle">
            {open.length} open · Pulse prioritized them by deadline, effort & workload
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface/60 px-2 py-1.5 text-xs text-muted">
            <Filter className="h-3.5 w-3.5" />
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as Category | "all")}
              className="bg-transparent text-fg focus:outline-none"
            >
              <option value="all">All categories</option>
              {settings.categories.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex rounded-xl border border-border p-0.5">
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition",
                  view === v ? "bg-surface-2 text-fg" : "text-subtle hover:text-fg"
                )}
                aria-label={v}
              >
                {v === "board" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>

          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {/* Board / List */}
      {view === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PRIORITIES.map((p) => {
              const items = open.filter((t) => t.priorityResult.priority === p);
              return (
                <div key={p} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", `bg-current ${PRIORITY_ACCENT[p]}`)} />
                      <span className="text-sm font-semibold text-fg">{PRIORITY_LABEL[p]}</span>
                    </div>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-subtle">{items.length}</span>
                  </div>
                  
                  <DroppableColumn id={p}>
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-subtle">
                        Drop here
                      </div>
                    ) : (
                      items.map((t) => <DraggableTask key={t.id} task={t} defaultOpen={t.id === focusId} />)
                    )}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>
          
          <DragOverlay>
            {activeTask ? (
              <div className="opacity-90 shadow-xl cursor-grabbing">
                <TaskCard task={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="mx-auto max-w-3xl space-y-2.5">
          {open.map((t) => (
            <TaskCard key={t.id} task={t} defaultOpen={t.id === focusId} />
          ))}
        </div>
      )}

      {/* Completed */}
      {doneList.length > 0 && (
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => setShowDone((s) => !s)}
            className="mb-2 text-xs font-medium text-subtle transition hover:text-fg"
          >
            {showDone ? "Hide" : "Show"} completed ({doneList.length})
          </button>
          {showDone && (
            <div className="space-y-2.5">
              {doneList.map((t: TaskWithIntel) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}

      <TaskCreateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
