"use client";

import { useState } from "react";
import { CreditCard, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RovvyLogo } from "@/components/RovvyLogo";

interface LivePaywallProps {
  tripId: string;
  onAccessGranted: () => void;
}

export function LivePaywall({ tripId, onAccessGranted }: LivePaywallProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchasePass = async (planType: string, priceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ checkout_url: string }>("/payments/create-checkout", {
        method: "POST",
        body: JSON.stringify({
          trip_id: tripId,
          price_id: priceId,
          plan_type: planType,
        }),
      });
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        throw new Error("Failed to generate checkout URL");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred initiating checkout");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-[#0F172A] p-8 text-center flex flex-col items-center gap-4">
          <RovvyLogo className="h-8 w-auto text-white" />
          <h2 className="text-2xl font-bold text-white tracking-tight mt-2">
            Trip LIVE Access
          </h2>
          <p className="text-sm text-slate-300">
            Activate real-time location coordinate tracking, group sync, and SOS features for this trip.
          </p>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Choose a Day Pass
            </h3>

            {/* Pass Options */}
            <div className="grid gap-3">
              <button
                disabled={loading}
                onClick={() => purchasePass("pass_3day", "price_3day")}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#0F766E] transition hover:shadow-md text-left"
              >
                <div>
                  <div className="font-semibold text-slate-800">3-Day Pass</div>
                  <div className="text-xs text-slate-500">Perfect for weekend getaways</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#0F766E]">$4.99</div>
                  <div className="text-[10px] text-slate-400">One-time</div>
                </div>
              </button>

              <button
                disabled={loading}
                onClick={() => purchasePass("pass_7day", "price_7day")}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#0F766E] transition hover:shadow-md text-left"
              >
                <div>
                  <div className="font-semibold text-slate-800">7-Day Pass</div>
                  <div className="text-xs text-slate-500">Ideal for full-week trips</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#0F766E]">$9.99</div>
                  <div className="text-[10px] text-slate-400">One-time</div>
                </div>
              </button>

              <button
                disabled={loading}
                onClick={() => purchasePass("pass_14day", "price_14day")}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#0F766E] transition hover:shadow-md text-left"
              >
                <div>
                  <div className="font-semibold text-slate-800">14-Day Pass</div>
                  <div className="text-xs text-slate-500">Best for long-duration vacations</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#0F766E]">$17.99</div>
                  <div className="text-[10px] text-slate-400">One-time</div>
                </div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <CreditCard className="h-3.5 w-3.5" /> Secure payment processed by Stripe.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
