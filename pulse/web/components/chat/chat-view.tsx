"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "@/components/providers/demo-store";
import { chatPlan } from "@/lib/ai/adapter";
import { MessageContent } from "@/components/ui/message-content";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import type { ChatMessage, Mutation, Task } from "@/lib/types";

/** Turn a model-created partial task into a full Task with sane defaults. */
function toTask(partial: Partial<Task> & { title: string; deadline: string }): Task {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: partial.title,
    description: partial.description,
    category: partial.category ?? "other",
    difficulty: partial.difficulty ?? "medium",
    estimateMin: partial.estimateMin ?? 60,
    deadline: partial.deadline,
    status: partial.status ?? "todo",
    progress: partial.progress ?? 0,
    subtasks: partial.subtasks ?? [],
    createdAt: new Date().toISOString(),
    importance: partial.importance,
    preferredWindow: partial.preferredWindow,
  };
}

const STARTERS = [
  "Plan my entire week — 2 assignments, an interview, and an exam.",
  "What should I work on right now?",
  "Am I going to miss any deadlines?",
  "Organize my day around my meetings.",
];

export function ChatView() {
  const { chat, pushChat, tasksDerived, events, now, addTask, updateTask, deleteTask } = useStore();
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [chips, setChips] = React.useState<string[]>(STARTERS);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, thinking]);

  /** Apply the mutations the AI returned to the global task store. */
  function applyMutations(mutations?: Mutation[]) {
    if (!mutations?.length) return;
    for (const m of mutations) {
      if (m.type === "create") {
        if (m.task?.title && m.task?.deadline) addTask(toTask(m.task));
      } else if (m.type === "update") {
        if (m.id) updateTask(m.id, m.updates ?? {});
      } else if (m.type === "delete") {
        if (m.id) deleteTask(m.id);
      }
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    setInput("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content, at: new Date().toISOString() };
    pushChat(userMsg);
    setThinking(true);
    const res = await chatPlan({ message: content, tasks: tasksDerived, events, now });
    // Apply any task create/update/delete the AI performed via tool calling.
    applyMutations(res.mutations);
    pushChat({ id: `a-${Date.now()}`, role: "assistant", content: res.reply, at: new Date().toISOString() });
    setChips(res.chips?.length ? res.chips : STARTERS);
    setThinking(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-3xl flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto pb-4 pr-1">
        {chat.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-sm text-subtle">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-3">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl glass px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pulse is planning…
            </span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 pt-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {chips.slice(0, 4).map((c) => (
            <button
              key={c}
              onClick={() => send(c)}
              disabled={thinking}
              className="rounded-full border border-border bg-surface/50 px-3 py-1.5 text-xs text-muted transition hover:border-brand/40 hover:text-fg disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="glass-strong flex items-end gap-2 rounded-2xl p-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask Pulse to plan, prioritize, or reschedule…"
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-subtle">
          Pulse plans from your real tasks & calendar. Enter to send · Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      {isUser ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-semibold text-white">
          RS
        </span>
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-3">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser ? "bg-brand/15 text-fg" : "glass"
        )}
      >
        {isUser ? <p className="text-sm text-fg">{msg.content}</p> : <MessageContent text={msg.content} />}
      </div>
    </motion.div>
  );
}
