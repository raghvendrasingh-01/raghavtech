"""LLM integration via the OpenAI SDK. Works with OpenAI *or* OpenRouter
(OpenRouter is OpenAI-compatible — we just swap the base URL and key).

When a key is configured the AI chat uses the model to phrase replies AND can
call tools to mutate the user's tasks. Because the AI routes are stateless and
the frontend holds the source-of-truth state, tool calls are *not* executed on
the server — they are parsed into a list of `mutations` that the frontend
applies to its in-memory store."""
from __future__ import annotations

import json

from app.config import get_settings

SYSTEM_PROMPT = (
    "You are Pulse, an AI Chief of Staff. You are proactive, concise and warm. "
    "You help the user beat deadlines by planning, prioritizing and rescheduling. "
    "Ground every answer in the provided task/risk context. "
    "When the user asks to add, change, reschedule, complete, or remove tasks, "
    "use the provided tools (create_task, update_task, delete_task) to do it — "
    "do not just describe the change. You may call several tools in one turn. "
    "After acting, briefly confirm what you did. "
    "Keep replies under ~120 words and use markdown sparingly (bold for task names)."
)

# ---- Tool (function) schemas exposed to the model ----------------------------

_CATEGORY_ENUM = ["study", "work", "personal", "health", "interview", "project", "finance", "other"]
_DIFFICULTY_ENUM = ["easy", "medium", "hard"]
_STATUS_ENUM = ["todo", "in_progress", "done", "missed"]

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short task title."},
                    "description": {"type": "string"},
                    "category": {"type": "string", "enum": _CATEGORY_ENUM},
                    "difficulty": {"type": "string", "enum": _DIFFICULTY_ENUM},
                    "estimateMin": {"type": "integer", "description": "Estimated minutes to complete."},
                    "deadline": {"type": "string", "description": "ISO 8601 datetime of the deadline."},
                    "importance": {"type": "integer", "minimum": 1, "maximum": 5},
                },
                "required": ["title", "deadline"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Update fields of an existing task, identified by its id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "The id of the task to update."},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "category": {"type": "string", "enum": _CATEGORY_ENUM},
                    "difficulty": {"type": "string", "enum": _DIFFICULTY_ENUM},
                    "estimateMin": {"type": "integer"},
                    "deadline": {"type": "string", "description": "ISO 8601 datetime."},
                    "importance": {"type": "integer", "minimum": 1, "maximum": 5},
                    "status": {"type": "string", "enum": _STATUS_ENUM},
                    "progress": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task, identified by its id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "The id of the task to delete."},
                },
                "required": ["id"],
            },
        },
    },
]


def _client_and_headers():
    settings = get_settings()
    from openai import AsyncOpenAI  # optional dependency

    client = AsyncOpenAI(api_key=settings.llm_key, base_url=settings.resolved_base_url)
    # OpenRouter recommends these headers for attribution (harmless on OpenAI).
    extra_headers = {"HTTP-Referer": "https://pulse.app", "X-Title": "Pulse"}
    return client, settings.llm_model, extra_headers


def _tool_call_to_mutation(name: str, args: dict) -> dict | None:
    """Map a parsed tool call into a frontend mutation instruction."""
    if name == "create_task":
        return {"type": "create", "task": args}
    if name == "update_task":
        task_id = args.pop("id", None)
        if not task_id:
            return None
        return {"type": "update", "id": task_id, "updates": args}
    if name == "delete_task":
        task_id = args.get("id")
        if not task_id:
            return None
        return {"type": "delete", "id": task_id}
    return None


async def llm_reply(message: str, context: str) -> str | None:
    """Text-only reply (kept for callers that don't want tool calling)."""
    reply, _ = await llm_reply_with_tools(message, context)
    return reply


async def llm_reply_with_tools(message: str, context: str) -> tuple[str | None, list[dict]]:
    """Generate a reply, letting the model call tools to mutate tasks.

    Returns (reply_text, mutations). `mutations` is a list of frontend
    instructions like {"type": "create", "task": {...}}. Falls back to
    (None, []) when no LLM is configured or on any error, so the caller can use
    the deterministic engine reply instead.
    """
    settings = get_settings()
    if not settings.has_llm:
        return None, []
    try:
        from openai import AsyncOpenAI  # noqa: F401  (import guard)
    except ImportError:
        return None, []

    try:
        client, model, extra_headers = _client_and_headers()
        messages: list[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{context}\n\nUser: {message}"},
        ]

        first = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.4,
            max_tokens=500,
            extra_headers=extra_headers,
        )
        choice = first.choices[0]
        tool_calls = choice.message.tool_calls or []

        if not tool_calls:
            return choice.message.content, []

        # Collect mutations and echo tool results back so the model can phrase
        # a natural-language confirmation.
        mutations: list[dict] = []
        messages.append(choice.message.model_dump(exclude_none=True))
        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            mutation = _tool_call_to_mutation(tc.function.name, dict(args))
            if mutation:
                mutations.append(mutation)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps({"ok": True}),
            })

        # Second call: get the confirmation text now that tools have "run".
        second = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.4,
            max_tokens=400,
            extra_headers=extra_headers,
        )
        return second.choices[0].message.content, mutations
    except Exception:
        return None, []
