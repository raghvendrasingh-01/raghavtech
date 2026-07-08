"""Rule-based planning brain (Python port). GPT overrides this when a key is set."""
from __future__ import annotations

import re
from datetime import datetime

from app.schemas import Task, CalendarEvent
from app.intelligence.priority import compute_priority, ensure_aware
from app.intelligence.risk import compute_risk
from app.intelligence.scheduler import generate_schedule, generate_range


def _fmt_time(dt: datetime) -> str:
    return ensure_aware(dt).strftime("%-I:%M %p")


def _classify(msg: str) -> str:
    m = msg.lower()
    if re.search(r"(this week|week|next 7 days|weekly)", m):
        return "plan_week"
    if re.search(r"(plan|schedule|organi[sz]e).*(day|today|tomorrow)", m):
        return "plan_day"
    if re.search(r"(what.*(now|next|first)|focus|start with|should i do)", m):
        return "focus_now"
    if re.search(r"(miss|risk|behind|late|on track|make it)", m):
        return "risk"
    if re.search(r"(plan|schedule|organi[sz]e)", m):
        return "plan_day"
    return "summary"


def _ranked(tasks: list[Task], now: datetime):
    open_tasks = [t for t in tasks if t.status not in ("done", "missed")]
    return sorted(((t, compute_priority(t, now)) for t in open_tasks), key=lambda x: -x[1].score)


def plan_from_message(message: str, tasks: list[Task], events: list[CalendarEvent], now: datetime) -> dict:
    intent = _classify(message)
    ranked = _ranked(tasks, now)

    if intent == "focus_now":
        if not ranked:
            return {"reply": "You're all clear — nothing open right now.", "chips": ["Plan tomorrow"]}
        top, p = ranked[0]
        r = compute_risk(top, now, events)
        return {"reply": f"Do **{top.title}** next. {p.reason}\n\n{r.message} {r.recommendation}",
                "chips": ["Schedule it now", "Break it down", "Show my day"]}

    if intent == "risk":
        at_risk = sorted(((t, compute_risk(t, now, events)) for t, _ in ranked), key=lambda x: -x[1].risk)
        at_risk = [x for x in at_risk if x[1].risk >= 55]
        if not at_risk:
            return {"reply": "Good news — nothing is in the danger zone right now.", "chips": ["Plan my day"]}
        lines = "\n".join(f"- **{t.title}** — {r.risk}% miss risk. {r.message}" for t, r in at_risk[:4])
        return {"reply": f"Here's what could slip:\n\n{lines}\n\nWant me to rebuild your day around the riskiest ones?",
                "chips": ["Rescue my deadlines", "Break down the top one"]}

    if intent == "plan_week":
        rng = generate_range(tasks, events, now, days=7)
        lines = []
        for i, day in enumerate(rng["days"]):
            focus = [b for b in day["blocks"] if b.kind == "focus"]
            if not focus:
                continue
            label = "Today" if i == 0 else day["date"].strftime("%A")
            titles = []
            for b in focus:
                if not titles or titles[-1] != b.title:
                    titles.append(b.title)
            items = " · ".join(f"{_fmt_time(next(f.start for f in focus if f.title == t))} {t}" for t in titles[:3])
            lines.append(f"**{label}** — {items}{' …' if len(titles) > 3 else ''}")
        warn = ""
        if rng["unplaced"]:
            names = ", ".join(u["title"] for u in rng["unplaced"][:2])
            warn = f"\n\n⚠️ {len(rng['unplaced'])} item(s) won't fit this week ({names}). Consider trimming scope."
        return {"reply": "Here's a plan for your week, weighted by priority and deadline risk:\n\n"
                + "\n".join(lines) + warn
                + "\n\nI front-loaded the highest-risk work. Say the word and I'll drop it on your calendar.",
                "chips": ["Regenerate", "Show risks", "Add a task"]}

    # plan_day / summary
    res = generate_schedule(tasks, events, now)
    blocks = res["blocks"]
    focus = [b for b in blocks if b.kind == "focus"]
    if not focus and not ranked:
        return {"reply": "Nothing to schedule yet. Add a task or two and I'll build your day around them.", "chips": ["Add a task"]}
    timeline = "\n".join(
        f"{_fmt_time(b.start)}–{_fmt_time(b.end)}  "
        f"{'📅' if b.kind == 'event' else '☕' if b.kind == 'break' else '🚨' if b.rescue else '🎯'} {b.title}"
        for b in blocks[:8] if b.kind != "buffer"
    )
    warn = ""
    if res["unplaced"]:
        names = ", ".join(u["title"] for u in res["unplaced"][:2])
        warn = f"\n\n⚠️ I couldn't fit {len(res['unplaced'])} item(s) today ({names})."
    return {"reply": f"Here's your day, built around your meetings and weighted by priority:\n\n```\n{timeline}\n```{warn}",
            "chips": ["Regenerate", "What's most urgent?", "Reschedule around a new meeting"]}
