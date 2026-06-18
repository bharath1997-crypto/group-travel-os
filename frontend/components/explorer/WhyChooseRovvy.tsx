"use client";

import { Users, Compass, Shield, DollarSign } from "lucide-react";

const TRUST_CARDS = [
  {
    icon: Users,
    title: "Plan together",
    description:
      "Collaborative itineraries where everyone gets a vote on what to do next.",
    iconBg: "bg-teal-50",
    iconColor: "text-[#0F766E]",
  },
  {
    icon: Compass,
    title: "Discover smarter",
    description:
      "AI suggestions custom-tailored to your season, group size, and location.",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    icon: Shield,
    title: "Travel safer",
    description:
      "Real-time safety alerts and security guides for every region worldwide.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: DollarSign,
    title: "Split easier",
    description:
      "Keep the math simple and ensure expenses are settled seamlessly after every trip.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
] as const;

export function WhyChooseRovvy() {
  return (
    <div className="w-full bg-[#F8FAFC] py-16 border-t border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Why choose Rovvy
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            We make travel smoother, safer, and more collaborative for every group.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {TRUST_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow duration-200"
              >
                <div
                  className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center ${card.iconColor}`}
                >
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{card.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
