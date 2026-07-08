import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const difficulty = formData.get("difficulty") as string;
    const deadline = formData.get("deadline") as string;
    const estimate = formData.get("estimate") as string;
    const manualSubtasks = formData.get("manualSubtasks") as string;

    const files = formData.getAll("files") as File[];
    
    let attachedText = "";
    const imageUrls: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.type === "application/pdf") {
        try {
          if (typeof global.DOMMatrix === "undefined") {
            (global as any).DOMMatrix = class DOMMatrix {};
          }
          if (typeof global.Path2D === "undefined") {
            (global as any).Path2D = class Path2D {};
          }
          const pdfParse = require("pdf-parse");
          const pdfData = await pdfParse(buffer);
          attachedText += `\n--- PDF Content (${file.name}) ---\n${pdfData.text.substring(0, 5000)}\n`;
        } catch (e) {
          console.error("PDF parse error", e);
        }
      } else if (file.type.startsWith("image/")) {
        const base64 = buffer.toString("base64");
        imageUrls.push(`data:${file.type};base64,${base64}`);
      }
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "No OPENROUTER_API_KEY found in environment" }, { status: 500 });
    }

    const promptText = `
You are Pulse, an AI task analyzer. Analyze this new task and provide concise insights.
Task Title: ${title}
Description: ${description || "None"}
Category: ${category}
Difficulty: ${difficulty}
Estimated Time: ${estimate} mins
Deadline: ${deadline}
${manualSubtasks && manualSubtasks !== "[]" ? `Existing Manual Subtasks:\n${manualSubtasks}` : ""}

${attachedText ? `Attached Text Documents:\n${attachedText}` : ""}

Provide a JSON response strictly matching this structure:
{
  "complexity": "Short description of complexity",
  "risks": "Potential risks or 'None'",
  "missingInfo": "What is missing or 'None'",
  "recommendation": "One sentence actionable recommendation",
  "subtasks": [
    {"title": "Subtask 1", "estimateMin": 15}
  ] // If they provided manual subtasks, you can suggest additional ones or refine theirs.
}
Keep it very concise. Only output valid JSON.`;

    const content: any[] = [{ type: "text", text: promptText }];
    for (const img of imageUrls) {
      content.push({ type: "image_url", image_url: { url: img } });
    }

    // Use gpt-4o-mini which is fast, cheap, and supports vision.
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "OpenRouter API failed", details: errText }, { status: 500 });
    }

    const data = await res.json();
    const resultText = data.choices[0].message.content;
    const parsed = JSON.parse(resultText);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Analysis Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
