"use client";

import { usePlanStore } from '../lib/store'

export default function PlanPreview() {
  const plan = usePlanStore(s => s.plan)
  if (!plan) return null
  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="text-xl font-semibold">Plan Preview</h2>
      <pre className="mt-2 overflow-auto text-sm bg-gray-50 p-3 rounded">{JSON.stringify(plan, null, 2)}</pre>
    </div>
  )
}
