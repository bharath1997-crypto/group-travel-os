import { NextRequest, NextResponse } from "next/server";

import { resolveHero } from "@/lib/hero-server";
import { unknownHero } from "@/lib/hero-location";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const lat = request.nextUrl.searchParams.get("lat");
    const lon = request.nextUrl.searchParams.get("lon");
    const response = await resolveHero({
      lat,
      lon,
      clientIp: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
    });
    return NextResponse.json(response, {
      status: 200,
      headers: { "Cache-Control": "private, max-age=0, no-store" },
    });
  } catch {
    return NextResponse.json(unknownHero(), {
      status: 200,
      headers: { "Cache-Control": "private, max-age=0, no-store" },
    });
  }
}
