"use client";

import * as React from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Subtask } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SubtaskEditorProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}

export function SubtaskEditor({ subtasks, onChange }: SubtaskEditorProps) {
  const [inputValue, setInputValue] = React.useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = subtasks.findIndex((i) => i.id === active.id);
      const newIndex = subtasks.findIndex((i) => i.id === over.id);
      onChange(arrayMove(subtasks, oldIndex, newIndex));
    }
  }

  function handleAdd() {
    if (inputValue.trim()) {
      onChange([...subtasks, { id: `man-${Date.now()}`, title: inputValue.trim(), estimateMin: 15, done: false }]);
      setInputValue("");
    }
  }

  function handleUpdate(id: string, newTitle: string) {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, title: newTitle } : s)));
  }

  function handleRemove(id: string) {
    onChange(subtasks.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Add a subtask and press enter..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      
      {subtasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {subtasks.map((s) => (
                <SortableItem key={s.id} subtask={s} onUpdate={handleUpdate} onRemove={handleRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableItem({ subtask, onUpdate, onRemove }: { subtask: Subtask; onUpdate: (id: string, t: string) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-2 py-1.5 text-xs transition focus-within:border-brand">
      <button type="button" className="cursor-grab text-subtle hover:text-fg touch-none p-0.5" {...attributes} {...listeners}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <input
        value={subtask.title}
        onChange={(e) => onUpdate(subtask.id, e.target.value)}
        className={cn("flex-1 bg-transparent outline-none truncate transition", subtask.done ? "text-subtle line-through" : "text-fg")}
      />
      <button onClick={() => onRemove(subtask.id)} className="text-subtle hover:text-critical p-0.5" type="button">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
