"use client";

import { Car, Bike, Footprints, ArrowRight } from "lucide-react";

type TransportModeModalProps = {
  isOpen: boolean;
  onSelect: (mode: "driving" | "bike" | "foot") => void;
};

export function TransportModeModal({ isOpen, onSelect }: TransportModeModalProps) {
  if (!isOpen) return null;

  const choices = [
    {
      id: "driving" as const,
      label: "4-Wheeler",
      subLabel: "Car / SUV / Truck",
      description: "Ideal for roadtrips and highway routes.",
      icon: Car,
      color: "bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-300",
      btnColor: "bg-purple-600 hover:bg-purple-700",
    },
    {
      id: "bike" as const,
      label: "2-Wheeler",
      subLabel: "Bicycle / Motorcycle",
      description: "For trails and bike-friendly navigation.",
      icon: Bike,
      color: "bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300",
      btnColor: "bg-blue-600 hover:bg-blue-700",
    },
    {
      id: "foot" as const,
      label: "Walking",
      subLabel: "Foot / Hike / Trek",
      description: "Optimized for treks, walking trails, and sidewalks.",
      icon: Footprints,
      color: "bg-teal-50 text-[#0F766E] border-teal-100 hover:border-teal-300",
      btnColor: "bg-[#0F766E] hover:bg-teal-800",
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-stone-900">Select Transport Mode</h2>
          <p className="text-sm text-stone-500 mt-1">
            This determines your map icon, routing system, and group telemetry.
          </p>
        </div>

        <div className="space-y-3">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onSelect(choice.id)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${choice.color}`}
            >
              <div className="flex items-center gap-4">
                <span className="rounded-xl bg-white p-3 shadow-sm shrink-0">
                  <choice.icon size={24} />
                </span>
                <div>
                  <h3 className="font-bold text-stone-850 flex items-center gap-1.5">
                    {choice.label}
                    <span className="text-[10px] font-semibold text-stone-400">({choice.subLabel})</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 leading-snug">{choice.description}</p>
                </div>
              </div>
              <span className="rounded-full bg-white p-1.5 shadow-sm text-stone-450 hover:text-stone-700">
                <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 text-center">
          <span className="text-[10px] font-semibold text-stone-400">
            You can change your transport mode anytime from the top bar selector.
          </span>
        </div>
      </div>
    </div>
  );
}
