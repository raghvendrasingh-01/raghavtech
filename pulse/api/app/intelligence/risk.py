"""Deadline-risk engine (Python port)."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.schemas import Task, CalendarEvent, RiskResult
from app.intelligence.priority import clamp, ensure_aware, work_remaining_min


def _overlap_minutes(a_s, a_e, b_s, b_e) -> float:
    s = max(a_s, b_s)
    e = min(a_e, b_e)
    return max(0.0, (e - s).total_seconds() / 60.0)


def free_minutes_before(
    deadline: datetime, now: datetime, events: list[CalendarEvent],
    day_start: int = 8, day_end: int = 22,
) -> float:
    now = ensure_aware(now)
    end = ensure_aware(deadline)
    if end <= now:
        return 0.0

    free = 0.0
    cursor = now
    for _ in range(60):
        if cursor >= end:
            break
        day_s = cursor.replace(hour=day_start, minute=0, second=0, microsecond=0)
        day_e = cursor.replace(hour=day_end, minute=0, second=0, microsecond=0)
        window_start = max(cursor, day_s)
        window_end = min(end, day_e)
        if window_end > window_start:
            avail = (window_end - window_start).total_seconds() / 60.0
            for ev in events:
                avail -= _overlap_minutes(window_start, window_end, ensure_aware(ev.start), ensure_aware(ev.end))
            free += max(0.0, avail)
        # advance to next midnight
        cursor = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return round(free)


def _risk_from_coverage(coverage: float) -> float:
    if coverage >= 1.5:
        return clamp(10 - (coverage - 1.5) * 8, 2, 10)
    if coverage >= 1.0:
        return 45 - ((coverage - 1.0) / 0.5) * 35
    if coverage >= 0.5:
        return 80 - ((coverage - 0.5) / 0.5) * 35
    return 99 - (coverage / 0.5) * 19


def compute_risk(task: Task, now: datetime, events: list[CalendarEvent] | None = None) -> RiskResult:
    events = events or []
    work_min = work_remaining_min(task)
    free_min = free_minutes_before(task.deadline, now, events)
    past = ensure_aware(task.deadline) <= ensure_aware(now)

    if task.status == "done" or work_min <= 0:
        return RiskResult(risk=0, level="safe", work_remaining_min=0, free_time_before_deadline_min=free_min,
                          message="Done — nothing left to worry about.", recommendation="Nice. One less thing on your plate.")

    if past:
        risk = 99.0
    elif free_min <= 0:
        risk = 97.0
    else:
        risk = _risk_from_coverage(free_min / work_min)
    risk = round(clamp(risk, 0, 99))

    level = "critical" if risk >= 80 else "high" if risk >= 55 else "watch" if risk >= 30 else "safe"
    work_h = round(work_min / 60, 1)
    free_h = round(free_min / 60, 1)

    return RiskResult(
        risk=risk, level=level, work_remaining_min=work_min, free_time_before_deadline_min=free_min,
        message=_message(level, work_h, free_h, past), recommendation=_recommendation(level, free_min),
    )


def _message(level: str, work_h: float, free_h: float, past: bool) -> str:
    if past:
        return "This deadline has passed and the task is unfinished."
    return {
        "critical": f"You are likely to miss this. ~{work_h}h of work remain but only ~{free_h}h are free before the deadline.",
        "high": f"Cutting it close. ~{work_h}h of work vs. ~{free_h}h free — one distraction and it slips.",
        "watch": f"On track, but no room to waste. ~{work_h}h of work, ~{free_h}h available.",
        "safe": f"Comfortable. ~{free_h}h free for ~{work_h}h of work.",
    }[level]


def _recommendation(level: str, free_min: float) -> str:
    if level == "critical":
        return ("There isn't enough free time — cut scope, delegate, or move the deadline. I can break it into a minimal version."
                if free_min <= 0 else "Start immediately and protect a focus block now. Let me reshuffle your day to fit it.")
    return {
        "high": "Block a focus session in your next free slot today. I can schedule it for you.",
        "watch": "Slot it into today or tomorrow morning so a surprise meeting can't derail it.",
        "safe": "No action needed yet — I'll keep watching it.",
    }[level]
