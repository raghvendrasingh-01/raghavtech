import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { title, category, subtasks } = await req.json();

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "No OPENROUTER_API_KEY found" }, { status: 500 });
    }

    const promptText = `
You are Pulse, an AI task planner. Write a concise, 1-2 sentence description for this task based on the title, category, and subtasks.
Task Title: ${title}
Category: ${category}
Subtasks: ${subtasks.join(", ")}

Only return the raw description text. Keep it brief and actionable.
    `.trim();

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: promptText }],
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "OpenRouter API failed", details: errText }, { status: 500 });
    }

    const data = await res.json();
    const description = data.choices[0].message.content.trim();

    return NextResponse.json({ description });
  } catch (err: any) {
    console.error("Generate Description Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
