"use client";

import { usePathname } from "next/navigation";
import { Plane } from "lucide-react";
import CheckoutStepper from "@/components/travel/CheckoutStepper";

export default function FlightCheckoutLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  let step = 2;
  if (pathname.includes("/extras")) step = 3;
  else if (pathname.includes("/review")) step = 4;
  else if (pathname.includes("/payment")) step = 5;
  else if (pathname.includes("/travelers")) step = 2;

  const stepLabel = ["Travelers", "Extras", "Review", "Payment"][step - 2] ?? "Booking";

  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl border border-slate-200/80 bg-app text-slate-800 shadow-sm">
      {/* Checkout Header */}
      <div className="rounded-t-3xl border-b border-slate-200/80 bg-white px-6 py-5 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-100">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 md:text-2xl">Complete your booking</h1>
              <p className="text-xs font-semibold text-slate-500">
                {stepLabel} details
              </p>
            </div>
          </div>
          <CheckoutStepper current={step} />
        </div>
      </div>

      {/* Page Content */}
      <div className="mx-auto max-w-4xl px-6 py-7 md:px-8">
        {children}
      </div>
    </div>
  );
}
