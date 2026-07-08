"""Smart scheduler (Python port) with multi-day work depletion."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.schemas import Task, CalendarEvent, ScheduleBlock
from app.intelligence.priority import compute_priority, work_remaining_min, ensure_aware
from app.intelligence.risk import compute_risk

_seq = 0


def _bid(prefix: str) -> str:
    global _seq
    _seq += 1
    return f"{prefix}-{_seq}"


def _same_day(a: datetime, b: datetime) -> bool:
    return a.date() == b.date()


def _compute_gaps(start: datetime, end: datetime, busy: list[tuple[datetime, datetime]]):
    gaps = []
    cursor = start
    for s, e in sorted(busy, key=lambda x: x[0]):
        if s > cursor:
            gaps.append((cursor, min(s, end)))
        cursor = max(cursor, e)
        if cursor >= end:
            break
    if cursor < end:
        gaps.append((cursor, end))
    return [(s, e) for s, e in gaps if (e - s).total_seconds() / 60 >= 10]


def build_candidates(tasks: list[Task], events: list[CalendarEvent], now: datetime) -> list[dict]:
    cands = [
        {
            "task": t,
            "remaining": work_remaining_min(t),
            "score": compute_priority(t, now).score,
            "risk": compute_risk(t, now, events).risk,
            "deadline": ensure_aware(t.deadline),
        }
        for t in tasks
        if t.status not in ("done", "missed") and work_remaining_min(t) > 0
    ]
    cands.sort(key=lambda c: (-c["score"], c["deadline"]))
    return cands


def fill_day(date: datetime, now: datetime, events: list[CalendarEvent], candidates: list[dict], cfg: dict) -> list[ScheduleBlock]:
    day_start, day_end = cfg["day_start"], cfg["day_end"]
    max_focus, break_min = cfg["max_focus"], cfg["break_min"]

    day_s = date.replace(hour=day_start, minute=0, second=0, microsecond=0)
    day_e = date.replace(hour=day_end, minute=0, second=0, microsecond=0)
    window_start = max(ensure_aware(now), day_s) if _same_day(date, now) else day_s
    window_end = day_e

    day_events = [e for e in events if _same_day(ensure_aware(e.start), date)]
    busy = [(ensure_aware(e.start), ensure_aware(e.end)) for e in day_events]

    blocks: list[ScheduleBlock] = [
        ScheduleBlock(id=_bid("evt"), title=e.title, kind="event", start=e.start, end=e.end)
        for e in day_events
    ]

    since_break = 0.0
    for gap_start, gap_end in _compute_gaps(window_start, window_end, busy):
        cursor = gap_start
        while cursor < gap_end:
            cand = next((c for c in candidates if c["remaining"] > 0 and c["deadline"] > cursor), None)
            if not cand:
                break
            gap_left = (gap_end - cursor).total_seconds() / 60
            if gap_left < 15:
                break
            if since_break >= 105 and gap_left > break_min + 15:
                b_end = cursor + timedelta(minutes=break_min)
                blocks.append(ScheduleBlock(id=_bid("brk"), title="Break", kind="break", start=cursor, end=b_end))
                cursor = b_end
                since_break = 0
                continue
            until_deadline = (cand["deadline"] - cursor).total_seconds() / 60
            chunk = min(cand["remaining"], max_focus, gap_left, until_deadline)
            if chunk < 15:
                if until_deadline < 15:
                    cand["remaining"] = min(cand["remaining"], 0.0001)
                break
            b_end = cursor + timedelta(minutes=chunk)
            blocks.append(ScheduleBlock(
                id=_bid("task"), title=cand["task"].title, kind="focus", start=cursor, end=b_end,
                task_id=cand["task"].id, category=cand["task"].category, rescue=cand["risk"] >= 55,
            ))
            cursor = b_end
            cand["remaining"] -= chunk
            since_break += chunk

    blocks.sort(key=lambda b: b.start)
    return blocks


def _cfg(day_start=8, day_end=22, max_focus=90, break_min=15) -> dict:
    return {"day_start": day_start, "day_end": day_end, "max_focus": max_focus, "break_min": break_min}


def generate_schedule(tasks, events, now: datetime, date: datetime | None = None, **kw) -> dict:
    date = date or now
    cands = build_candidates(tasks, events, now)
    blocks = fill_day(date, now, events, cands, _cfg(**kw))
    unplaced = [{"task_id": c["task"].id, "title": c["task"].title, "minutes": round(c["remaining"])} for c in cands if c["remaining"] >= 1]
    return {"blocks": blocks, "unplaced": unplaced}


def generate_range(tasks, events, now: datetime, days: int = 7, **kw) -> dict:
    cfg = _cfg(**kw)
    cands = build_candidates(tasks, events, now)
    out_days = []
    for i in range(days):
        date = now + timedelta(days=i)
        out_days.append({"date": date, "blocks": fill_day(date, now, events, cands, cfg)})
    unplaced = [{"task_id": c["task"].id, "title": c["task"].title, "minutes": round(c["remaining"])} for c in cands if c["remaining"] >= 1]
    return {"days": out_days, "unplaced": unplaced}
