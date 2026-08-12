"use client";

import { Receipt } from "lucide-react";

type Line = { label: string; amount: number };

type Props = {
  currency: string;
  lines: Line[];
  totalLabel?: string;
};

export default function BookingPriceSummary({ currency, lines, totalLabel = "Total" }: Props) {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Receipt className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Price summary</h3>
      </div>

      <dl className="space-y-2.5 text-xs">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4 text-slate-600">
            <dt className="font-medium">{line.label}</dt>
            <dd className="font-bold text-slate-900">{fmt(line.amount)}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{totalLabel}</span>
          <div className="text-right">
            <span className="text-xl font-black text-slate-900">{fmt(total)}</span>
            <span className="ml-1 text-xs font-bold text-slate-400">{currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
