import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    
    // Using "oauth_google" is deprecated in newer Clerk versions, "google" is preferred.
    // However, if the user hasn't connected Google or hasn't re-authenticated to grant scopes, this throws a 400.
    let response;
    try {
      response = await client.users.getUserOauthAccessToken(userId, "oauth_google");
    } catch (err: any) {
      console.error("Clerk token error:", err.errors || err.message);
      return NextResponse.json(
        { error: "Could not fetch Google token. Please log out and log back in with Google to grant Calendar permissions." }, 
        { status: 400 }
      );
    }
    
    // In newer clerk versions, it returns a paginated list ({ data: [...] });
    // older versions returned the array directly. Handle both without typing drift.
    const r = response as unknown as { data?: { token?: string }[] } | { token?: string }[];
    const token = Array.isArray(r) ? r[0]?.token : r?.data?.[0]?.token;

    if (!token) {
      return NextResponse.json({ error: "No Google OAuth token found. Ensure you logged in with Google." }, { status: 403 });
    }

    const now = new Date();
    // Fetch from 1 day ago to 14 days in the future
    const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const calendarRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!calendarRes.ok) {
      const errorText = await calendarRes.text();
      return NextResponse.json({ error: "Failed to fetch calendar from Google", details: errorText }, { status: calendarRes.status });
    }

    const data = await calendarRes.json();
    
    // Map to Pulse CalendarEvent format
    const events = (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.summary || "Busy",
      start: item.start?.dateTime || item.start?.date || new Date().toISOString(),
      end: item.end?.dateTime || item.end?.date || new Date().toISOString(),
      kind: "meeting", // default kind
      location: item.location || "",
    }));

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
