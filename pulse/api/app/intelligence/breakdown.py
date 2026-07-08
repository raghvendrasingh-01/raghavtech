"""Task-analysis engine (Python port) — AI task creation."""
from __future__ import annotations

import re
from datetime import datetime

from app.schemas import TaskDraft, Task, Subtask, CalendarEvent, AnalyzeResponse
from app.intelligence.priority import compute_priority, ensure_aware
from app.intelligence.risk import compute_risk
from app.intelligence.scheduler import generate_schedule

DIFFICULTY_MULT = {"easy": 1.1, "medium": 1.28, "hard": 1.55}

TEMPLATES = {
    "study": [("Review the requirements", .15), ("Outline your approach", .2), ("Do the core work", .4), ("Check & test", .15), ("Finalize & submit", .1)],
    "interview": [("Review the key concepts", .25), ("Solve practice problems", .4), ("Review your mistakes", .2), ("Do a timed mock run", .15)],
    "project": [("Scope & plan the work", .15), ("Build the core", .45), ("Handle edge cases & polish", .25), ("Test & ship", .15)],
    "reading": [("Skim & set reading goals", .15), ("Read deeply and take notes", .6), ("Summarize the takeaways", .25)],
    "work": [("Gather context", .25), ("Draft the work", .5), ("Review & send", .25)],
    "generic": [("Break down the work", .2), ("Do the main part", .55), ("Review & wrap up", .25)],
}


def adjust_estimate(estimate_min: int, difficulty: str) -> int:
    return round(estimate_min * DIFFICULTY_MULT[difficulty] / 5) * 5


def _template_key(draft: TaskDraft) -> str | None:
    t = f"{draft.title} {draft.description or ''}".lower()
    if draft.estimate_min <= 25 or re.search(r"\b(pay|bill|email|call|text|book|renew|reply)\b", t):
        return None
    if re.search(r"\b(read|chapter|book|paper|article)\b", t):
        return "reading"
    if re.search(r"\b(interview|dsa|leetcode|mock|dp|algorithms?)\b", t):
        return "interview"
    if re.search(r"\b(build|ship|app|feature|deploy|mvp|prototype|design)\b", t):
        return "project"
    return draft.category if draft.category in TEMPLATES else "generic"


def suggest_subtasks(draft: TaskDraft, adjusted_min: int) -> list[Subtask]:
    key = _template_key(draft)
    if not key:
        return []
    return [
        Subtask(id=f"sub-{i}", title=title, done=False, estimate_min=max(10, round(adjusted_min * frac / 5) * 5))
        for i, (title, frac) in enumerate(TEMPLATES[key])
    ]


def suggest_milestones(goal_title: str) -> list[dict]:
    t = goal_title.lower()
    if re.search(r"\b(intern|internship|job|swe|faang|google|placement|offer)\b", t):
        return [{"title": "Finish DSA patterns", "eta_weeks": 4}, {"title": "System design fundamentals", "eta_weeks": 3},
                {"title": "Ship 2 portfolio projects", "eta_weeks": 4}, {"title": "Polish resume & LinkedIn", "eta_weeks": 1},
                {"title": "10 mock interviews", "eta_weeks": 4}]
    if re.search(r"\b(launch|startup|product|users|saas|app|business)\b", t):
        return [{"title": "Validate the problem", "eta_weeks": 1}, {"title": "Ship an MVP", "eta_weeks": 3},
                {"title": "Get first 10 users", "eta_weeks": 2}, {"title": "Iterate on feedback", "eta_weeks": 3}, {"title": "Public launch", "eta_weeks": 1}]
    return [{"title": "Break the goal into phases", "eta_weeks": 1}, {"title": "Build momentum with quick wins", "eta_weeks": 3},
            {"title": "Do the core work", "eta_weeks": 5}, {"title": "Review & finish strong", "eta_weeks": 2}]


def analyze_task(draft: TaskDraft, events: list[CalendarEvent], now: datetime) -> AnalyzeResponse:
    adjusted = adjust_estimate(draft.estimate_min, draft.difficulty)
    delta = round((adjusted - draft.estimate_min) / draft.estimate_min * 100) if draft.estimate_min else 0
    subtasks = suggest_subtasks(draft, adjusted)

    synthetic = Task(
        id="draft", title=draft.title or "Untitled task", description=draft.description,
        category=draft.category, difficulty=draft.difficulty, estimate_min=adjusted,
        deadline=draft.deadline, status="todo", progress=0, subtasks=subtasks, importance=draft.importance,
    )
    priority = compute_priority(synthetic, now)
    risk = compute_risk(synthetic, now, events)

    notes = []
    if delta > 0:
        notes.append(f"Similar {draft.difficulty} tasks run ~{delta}% over — I've planned for {round(adjusted / 60, 1)}h.")
    if risk.risk >= 55:
        notes.append(f"⚠️ {risk.risk}% miss risk. {risk.recommendation}")
    if subtasks:
        notes.append(f"Split into {len(subtasks)} steps so you can start small.")

    return AnalyzeResponse(
        priority=priority, risk=risk, adjusted_estimate_min=adjusted, estimate_delta_pct=delta,
        subtasks=subtasks, best_slot_label=None, notes=notes,
    )
