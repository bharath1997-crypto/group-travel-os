import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy for Overpass API (browser cannot call overpass-api.de
 * reliably due to CORS / mixed-content / network policies).
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body.trim()) {
    return NextResponse.json({ error: "Missing query body" }, { status: 400 });
  }

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Overpass proxy failed", elements: [] },
      { status: 502 },
    );
  }
}
