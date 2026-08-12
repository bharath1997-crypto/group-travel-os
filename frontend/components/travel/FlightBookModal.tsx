"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightRow, FlightSearchMeta } from "@/components/travel/RovvyFlightSearch";

type Props = {
  row: FlightRow;
  meta: FlightSearchMeta;
  onClose: () => void;
};

type BookResult = {
  order_id: string;
  booking_reference: string;
  total_amount: number;
  currency: string;
  live_mode: boolean;
  message: string;
};

function formatPrice(currency: string, price: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export default function FlightBookModal({ row, meta, onClose }: Props) {
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bornOn, setBornOn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookResult | null>(null);

  const routeLabel = `${meta.fromCode} → ${meta.toCode}`;

  const submit = async () => {
    if (!givenName.trim() || !familyName.trim() || !email.trim() || !phone.trim() || !bornOn) {
      setError("Fill in all passenger fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<BookResult>("/flights/book", {
        method: "POST",
        body: JSON.stringify({
          offer_id: row.id,
          passengers: [
            {
              given_name: givenName.trim(),
              family_name: familyName.trim(),
              email: email.trim(),
              phone_number: phone.trim(),
              born_on: bornOn,
              title: "mr",
              gender: "m",
            },
          ],
        }),
      });
      setSuccess(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Complete booking</h2>
            <p className="text-xs text-slate-500">Passenger details · stays in Rovvy</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{meta.fromLabel.split(",")[0]} → {meta.toLabel.split(",")[0]}</p>
            <p className="mt-1 text-xs text-slate-600">
              {routeLabel} · Depart {meta.departDate}
              {meta.roundTrip && meta.returnDate ? ` · Return ${meta.returnDate}` : ""}
            </p>
            <p className="mt-2 text-lg font-bold text-teal-700">{formatPrice(row.currency, row.price)}</p>
          </div>

          {success ? (
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-900">
              <p className="font-semibold">{success.message}</p>
              <p className="mt-2">
                Airline reference: <strong>{success.booking_reference}</strong>
              </p>
              {!success.live_mode ? (
                <p className="mt-2 text-xs text-teal-800">Test mode — no real ticket charged.</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passenger</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">First name</span>
                  <input
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    autoComplete="given-name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Last name</span>
                  <input
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    autoComplete="family-name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Phone (with country code)</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+14155550100"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Date of birth</span>
                <input
                  type="date"
                  value={bornOn}
                  onChange={(e) => setBornOn(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            {success ? "Done" : "Cancel"}
          </button>
          {!success ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void submit()}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? "Booking…" : "Confirm booking"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
