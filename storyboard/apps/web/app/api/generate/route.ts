import { NextRequest, NextResponse } from 'next/server'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(`${API_ORIGIN}/generate/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
