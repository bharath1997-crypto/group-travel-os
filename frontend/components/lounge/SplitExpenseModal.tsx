"use client";

import { useState } from "react";

type SplitExpenseModalProps = {
  open: boolean;
  currencySymbol: string;
  onClose: () => void;
  onSubmit: (amount: number, splitEqually: boolean) => void;
};

export function SplitExpenseModal({
  open,
  currencySymbol,
  onClose,
  onSubmit,
}: SplitExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [splitEqually, setSplitEqually] = useState(true);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold text-slate-900">Add split</p>
        <label className="mt-3 block text-[10px] font-bold uppercase text-stone-500">
          Amount
        </label>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-sm font-bold text-stone-600">{currencySymbol}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#0F766E]"
            placeholder="0.00"
          />
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={splitEqually}
            onChange={(e) => setSplitEqually(e.target.checked)}
            className="rounded"
          />
          Split equally
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-stone-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const n = parseFloat(amount);
              if (!Number.isFinite(n) || n <= 0) return;
              onSubmit(n, splitEqually);
              setAmount("");
              onClose();
            }}
            className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-bold text-white"
          >
            Add Split
          </button>
        </div>
      </div>
    </div>
  );
}
