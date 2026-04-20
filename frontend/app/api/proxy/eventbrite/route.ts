import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = process.env.NEXT_PUBLIC_EVENTBRITE_TOKEN || "";
  const { searchParams } = request.nextUrl;

  if (searchParams.get("health") === "1") {
    if (!token) {
      return NextResponse.json(
        { ok: false, status: 0 },
        { status: 503 },
      );
    }
    const res = await fetch("https://www.eventbriteapi.com/v3/users/me/", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok, status: res.status });
  }

  if (!token) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_EVENTBRITE_TOKEN" },
      { status: 503 },
    );
  }

  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const within = searchParams.get("within") || "50mi";

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat or lon" },
      { status: 400 },
    );
  }

  const url =
    `https://www.eventbriteapi.com/v3/events/search/` +
    `?location.latitude=${lat}` +
    `&location.longitude=${lon}` +
    `&location.within=${encodeURIComponent(within)}` +
    `&expand=venue,ticket_classes` +
    `&sort_by=date` +
    `&page_size=20`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
