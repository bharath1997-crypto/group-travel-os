"use client";

import {
  CheckCircle2,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import {
  SettingsBreadcrumb,
  nestedCrumbs,
} from "@/components/settings/SettingsBreadcrumb";

// ── Verification tier row ──────────────────────────────────────────────────────
function TierRow({
  icon: Icon,
  label,
  detail,
  status,
}: {
  icon: React.ElementType;
  label: string;
  detail: string;
  status: "verified" | "not-verified" | "coming-soon";
}) {
  const isDisabled = status === "coming-soon";

  return (
    <div
      className={`flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 last:border-b-0 ${
        isDisabled ? "cursor-default select-none opacity-80 pointer-events-none" : ""
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          status === "verified"
            ? "border-teal-100 bg-teal-50"
            : isDisabled
            ? "border-teal-100 bg-teal-50"
            : "border-stone-100 bg-stone-50"
        }`}
      >
        <Icon
          size={16}
          strokeWidth={1.8}
          className={
            status === "verified"
              ? "text-teal-700"
              : isDisabled
              ? "text-teal-400"
              : "text-stone-400"
          }
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400">{detail}</p>
      </div>

      {status === "verified" && (
        <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-600">
          <CheckCircle2 size={10} />
          Verified
        </span>
      )}
      {status === "not-verified" && (
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-600">
          Not verified
        </span>
      )}
      {status === "coming-soon" && (
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-600">
          Coming Soon
        </span>
      )}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <>
      <SettingsScreenHeader
        title="Verification"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Verification")}
      />

      {/* Overview card */}
      <div className="mx-3 mt-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-white">
            <ShieldCheck size={20} className="text-teal-700" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-teal-800">
              Account partially verified
            </p>
            <p className="mt-0.5 text-xs text-teal-700">
              Complete more verification steps to unlock your traveler badge.
            </p>
          </div>
        </div>
      </div>

      {/* Verification tiers */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Verification levels</SettingsSectionTitle>
        <TierRow
          icon={Mail}
          label="Email address"
          detail="Your registered email has been confirmed"
          status="verified"
        />
        <TierRow
          icon={Phone}
          label="Phone number"
          detail="Add and verify a mobile phone number"
          status="coming-soon"
        />
        <TierRow
          icon={Shield}
          label="Government ID"
          detail="Verify your identity with an official document"
          status="coming-soon"
        />
      </div>

      {/* Benefits */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Verification benefits</SettingsSectionTitle>

        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Star size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Verified traveler badge
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                A badge on your public profile lets other group members know you
                are a trusted member of the Rovvy community.
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <ShieldCheck size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Higher trust level
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                Verified accounts get faster trip approvals, higher expense
                limits, and fewer access restrictions.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <CheckCircle2 size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Secure group travel
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                Other travelers feel safer joining groups with verified members,
                improving the quality of trips for everyone.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SettingsPageFooter />
    </>
  );
}
