"""Priority engine (Python port of the frontend engine)."""
from __future__ import annotations

from datetime import datetime, timezone

from app.schemas import Task, PriorityResult, PriorityFactor

URGENCY_HORIZON_H = 120.0

CATEGORY_WEIGHT = {
    "interview": 1.0, "work": 0.85, "project": 0.8, "study": 0.75,
    "finance": 0.9, "health": 0.6, "personal": 0.5, "other": 0.5,
}
DIFFICULTY_WEIGHT = {"easy": 0.4, "medium": 0.65, "hard": 0.95}


def clamp(n: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, n))


def ensure_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def hours_until(deadline: datetime, now: datetime) -> float:
    return (ensure_aware(deadline) - ensure_aware(now)).total_seconds() / 3600.0


def work_remaining_min(task: Task) -> float:
    return max(0.0, task.estimate_min * (1 - clamp(task.progress)))


def compute_priority(task: Task, now: datetime) -> PriorityResult:
    hours_left = hours_until(task.deadline, now)
    work_h = work_remaining_min(task) / 60.0
    overdue = hours_left <= 0

    urgency = 1.0 if overdue else clamp((URGENCY_HORIZON_H - hours_left) / URGENCY_HORIZON_H)

    cat_w = CATEGORY_WEIGHT.get(task.category, 0.5)
    diff_w = DIFFICULTY_WEIGHT[task.difficulty]
    declared = (task.importance / 5) if task.importance else (cat_w + diff_w) / 2
    importance = clamp(0.55 * cat_w + 0.25 * diff_w + 0.2 * declared)

    effort = clamp(work_h / 8)

    runway = max(hours_left, 0.25)
    tightness = 1.0 if overdue else clamp(work_h / runway)

    composite = 0.42 * urgency + 0.24 * importance + 0.14 * effort + 0.2 * tightness
    score = round(clamp(composite) * 100)
    if overdue:
        score = max(score, 82)
    if tightness > 0.95:
        score = max(score, 70)

    priority = _band(score)

    factors = sorted(
        [
            PriorityFactor(label="Urgency", weight=round(urgency * 100), detail=_urgency_detail(hours_left, overdue)),
            PriorityFactor(label="Importance", weight=round(importance * 100), detail=f"{task.category} · {task.difficulty}"),
            PriorityFactor(label="Effort left", weight=round(effort * 100), detail=f"{round(work_h, 1)}h remaining"),
            PriorityFactor(label="Tightness", weight=round(tightness * 100), detail=_tightness_detail(work_h, runway, overdue)),
        ],
        key=lambda f: f.weight,
        reverse=True,
    )

    return PriorityResult(priority=priority, score=score, reason=_reason(priority, factors, overdue), factors=factors)


def _band(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _urgency_detail(hours_left: float, overdue: bool) -> str:
    if overdue:
        return f"overdue by {abs(round(hours_left))}h"
    if hours_left < 24:
        return f"due in {round(hours_left)}h"
    return f"due in {round(hours_left / 24)}d"


def _tightness_detail(work_h: float, runway: float, overdue: bool) -> str:
    if overdue:
        return "past deadline"
    ratio = work_h / runway
    if ratio >= 1:
        return "needs more time than is left"
    if ratio >= 0.6:
        return "little slack"
    return "comfortable slack"


def _reason(priority: str, factors: list[PriorityFactor], overdue: bool) -> str:
    top, second = factors[0], factors[1]
    if overdue:
        return f"Marked {priority.upper()} — this is past its deadline and still unfinished. Clear it first or renegotiate."
    lead = {"critical": "Critical", "high": "High priority", "medium": "Medium priority", "low": "Low priority"}[priority]
    return f"{lead} — driven mainly by {top.label.lower()} ({top.detail}), with {second.label.lower()} ({second.detail}) reinforcing it."
