import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    
    let response;
    try {
      response = await client.users.getUserOauthAccessToken(userId, "oauth_google");
    } catch (err: any) {
      console.error("Clerk token error:", err.errors || err.message);
      return NextResponse.json(
        { error: "Could not fetch Google token. Please log out and log back in with Google to grant Tasks permissions." }, 
        { status: 400 }
      );
    }
    
    const r = response as unknown as { data?: { token?: string }[] } | { token?: string }[];
    const token = Array.isArray(r) ? r[0]?.token : r?.data?.[0]?.token;

    if (!token) {
      return NextResponse.json({ error: "No Google OAuth token found. Ensure you logged in with Google." }, { status: 403 });
    }

    // Fetch tasks from the default task list
    const tasksRes = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!tasksRes.ok) {
      const errorText = await tasksRes.text();
      return NextResponse.json({ error: "Failed to fetch tasks from Google", details: errorText }, { status: tasksRes.status });
    }

    const data = await tasksRes.json();
    
    // Map to Pulse Task format
    const tasks = (data.items || []).map((item: any) => ({
      id: `gtask-${item.id}`,
      title: item.title || "Untitled Task",
      description: item.notes || "",
      category: "other", // default
      difficulty: "medium", // default
      estimateMin: 30, // default
      deadline: item.due ? new Date(item.due).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: item.status === "completed" ? "done" : "todo",
      progress: item.status === "completed" ? 1.0 : 0.0,
      subtasks: [],
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error("Google Tasks sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
