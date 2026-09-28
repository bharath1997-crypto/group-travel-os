import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = process.env.NEXT_PUBLIC_TICKETMASTER_KEY || "";
  const { searchParams } = request.nextUrl;

  if (searchParams.get("health") === "1") {
    if (!key) {
      return NextResponse.json(
        { ok: false, status: 0 },
        { status: 503 },
      );
    }
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(key)}&size=1`,
      { cache: "no-store" },
    );
    return NextResponse.json({ ok: res.ok, status: res.status });
  }

  if (!key) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_TICKETMASTER_KEY" },
      { status: 503 },
    );
  }

  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius") || "50";
  const size = searchParams.get("size") || "50";

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat or lon" },
      { status: 400 },
    );
  }

  let url =
    `https://app.ticketmaster.com/discovery/v2/events.json` +
    `?apikey=${encodeURIComponent(key)}` +
    `&latlong=${lat},${lon}` +
    `&radius=${radius}` +
    `&unit=miles` +
    `&size=${encodeURIComponent(size)}` +
    `&sort=date,asc`;

  const startDateTime = searchParams.get("startDateTime");
  const endDateTime = searchParams.get("endDateTime");
  const segmentId = searchParams.get("segmentId");
  const keyword = searchParams.get("keyword");

  if (startDateTime) {
    url += `&startDateTime=${encodeURIComponent(startDateTime)}`;
  }
  if (endDateTime) {
    url += `&endDateTime=${encodeURIComponent(endDateTime)}`;
  }
  if (segmentId) {
    url += `&segmentId=${encodeURIComponent(segmentId)}`;
  }
  if (keyword) {
    url += `&keyword=${encodeURIComponent(keyword)}`;
  }

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
