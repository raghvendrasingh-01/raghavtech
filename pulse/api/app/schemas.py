"""Pydantic models. Field aliases are camelCase so the payloads match the
Next.js frontend exactly (tasks/events flow through unchanged)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

Priority = Literal["critical", "high", "medium", "low"]
Category = Literal["study", "work", "personal", "health", "interview", "project", "finance", "other"]
Difficulty = Literal["easy", "medium", "hard"]
TaskStatus = Literal["todo", "in_progress", "done", "missed"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Subtask(CamelModel):
    id: str
    title: str
    done: bool = False
    estimate_min: int = 30


class Task(CamelModel):
    id: str
    title: str
    description: Optional[str] = None
    category: Category = "other"
    difficulty: Difficulty = "medium"
    estimate_min: int = 60
    deadline: datetime
    status: TaskStatus = "todo"
    progress: float = 0.0
    subtasks: list[Subtask] = []
    importance: Optional[int] = None
    preferred_window: Optional[str] = None
    created_at: Optional[datetime] = None


class CalendarEvent(CamelModel):
    id: str
    title: str
    start: datetime
    end: datetime
    kind: str = "event"
    location: Optional[str] = None


class PriorityFactor(CamelModel):
    label: str
    weight: float
    detail: str


class PriorityResult(CamelModel):
    priority: Priority
    score: float
    reason: str
    factors: list[PriorityFactor]


class RiskResult(CamelModel):
    risk: float
    level: Literal["safe", "watch", "high", "critical"]
    work_remaining_min: float
    free_time_before_deadline_min: float
    message: str
    recommendation: str


class ScheduleBlock(CamelModel):
    id: str
    title: str
    kind: str
    start: datetime
    end: datetime
    task_id: Optional[str] = None
    category: Optional[str] = None
    rescue: bool = False


# ---- request / response envelopes ----

class ChatRequest(CamelModel):
    message: str
    tasks: list[Task] = []
    events: list[CalendarEvent] = []
    now: Optional[datetime] = None


class Mutation(CamelModel):
    """An instruction for the frontend to apply to its in-memory task store.

    - type="create": `task` holds the new task (partial Task shape).
    - type="update": `id` + `updates` hold the fields to patch.
    - type="delete": `id` identifies the task to remove.
    """
    type: Literal["create", "update", "delete"]
    id: Optional[str] = None
    task: Optional[dict] = None
    updates: Optional[dict] = None


class ChatResponse(CamelModel):
    reply: str
    chips: list[str] = []
    schedule: Optional[list[ScheduleBlock]] = None
    mutations: list[Mutation] = []


class TaskDraft(CamelModel):
    title: str
    description: Optional[str] = None
    category: Category = "study"
    difficulty: Difficulty = "medium"
    estimate_min: int = 60
    deadline: datetime
    importance: Optional[int] = None


class AnalyzeRequest(CamelModel):
    draft: TaskDraft
    events: list[CalendarEvent] = []
    now: Optional[datetime] = None


class AnalyzeResponse(CamelModel):
    priority: PriorityResult
    risk: RiskResult
    adjusted_estimate_min: int
    estimate_delta_pct: float
    subtasks: list[Subtask]
    best_slot_label: Optional[str] = None
    notes: list[str]
