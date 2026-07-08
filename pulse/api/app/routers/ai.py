"""AI routes — the endpoints the Next.js frontend calls. All are stateless:
tasks/events come in the request body, so they work with or without a DB."""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter

from app.schemas import (
    ChatRequest, ChatResponse, AnalyzeRequest, AnalyzeResponse, ScheduleBlock, Mutation,
)
from app.intelligence import (
    plan_from_message, analyze_task, generate_schedule, compute_priority, compute_risk, suggest_milestones,
)
from app.llm import llm_reply_with_tools

router = APIRouter(prefix="/ai", tags=["ai"])


def _now(dt: datetime | None) -> datetime:
    return dt or datetime.now(timezone.utc)


def _context(req: ChatRequest, now: datetime) -> str:
    header = (
        f"The current date and time is {now.isoformat()}. "
        "Resolve all relative dates (e.g. 'tomorrow', 'next week') against this, "
        "and always output deadlines as full ISO 8601 datetimes.\n\n"
    )
    lines = []
    for t in req.tasks[:12]:
        p = compute_priority(t, now)
        r = compute_risk(t, now, req.events)
        # Include the id so update/delete tool calls can target the right task.
        lines.append(
            f"- [{t.id}] {t.title} · {p.priority} priority · {r.risk}% miss-risk · due {t.deadline.isoformat()}"
        )
    body = "Tasks:\n" + "\n".join(lines) if lines else "No tasks yet."
    return header + body


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    now = _now(req.now)
    result = plan_from_message(req.message, req.tasks, req.events, now)
    # If a GPT key is configured, let it phrase the reply AND optionally emit
    # task mutations via tool calls. The deterministic engine still supplies the
    # schedule/chips and the fallback reply. Mutations are returned for the
    # frontend to apply to its in-memory store (the backend stays stateless).
    gpt, mutations = await llm_reply_with_tools(req.message, _context(req, now))
    return ChatResponse(
        reply=gpt or result["reply"],
        chips=result.get("chips", []),
        schedule=result.get("schedule"),
        mutations=[Mutation.model_validate(m) for m in mutations],
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    return analyze_task(req.draft, req.events, _now(req.now))


@router.post("/schedule")
async def schedule(req: ChatRequest) -> dict:
    now = _now(req.now)
    res = generate_schedule(req.tasks, req.events, now)
    return {
        "blocks": [ScheduleBlock.model_validate(b, from_attributes=True).model_dump(by_alias=True) for b in res["blocks"]],
        "unplaced": res["unplaced"],
    }


@router.post("/goal-plan")
async def goal_plan(payload: dict) -> dict:
    title = payload.get("title", "")
    return {"milestones": suggest_milestones(title)}
