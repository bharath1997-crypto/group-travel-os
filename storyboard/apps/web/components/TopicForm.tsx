"use client";

import { useState } from 'react';
import { usePlanStore } from '../lib/store';

export default function TopicForm() {
  const [topic, setTopic] = useState('Solar System for 4th graders');
  const [pages, setPages] = useState(5);
  const [style, setStyle] = useState<'educational'|'manga'|'noir'|'pixar_like'|'sketch'>('educational');
  const setPlan = usePlanStore(s => s.setPlan);
  const plan = usePlanStore(s => s.plan);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, pages, style })
    });
    const data = await res.json();
    setPlan(data);
  };

  const onExport = async () => {
    if (!plan) return;
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    const out = await res.json();
    alert(out.ok ? `Exported: ${out.path}` : 'Export failed');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 bg-white p-4 rounded-lg border">
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Topic</label>
          <input className="mt-1 w-full rounded border px-3 py-2" value={topic} onChange={e=>setTopic(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Pages</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={pages} onChange={e=>setPages(Number(e.target.value))}>
            {[5,10,15].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Style</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={style} onChange={e=>setStyle(e.target.value as any)}>
            {['educational','manga','noir','pixar_like','sketch'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-gray-900 text-white px-4 py-2">Generate Plan</button>
        <button type="button" onClick={onExport} disabled={!plan} className="rounded bg-indigo-600 text-white px-4 py-2 disabled:opacity-50">Export PDF</button>
      </div>
    </form>
  );
}
