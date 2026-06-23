"use client";

import { ExternalLink, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

type SOSConfirmSheetProps = {
  fcmSentTo: number;
  groupMode: boolean;
  emergencyContacts: { name: string; phone: string }[];
  smsTemplate: string;
  googleMapsUrl: string;
  onCancelSos: () => void;
  onAddContacts: () => void;
};

export function SOSConfirmSheet({
  fcmSentTo,
  groupMode,
  emergencyContacts,
  smsTemplate,
  googleMapsUrl,
  onCancelSos,
  onAddContacts,
}: SOSConfirmSheetProps) {
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCanDismiss(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-red-700 text-white">
      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <h1 className="text-center text-3xl font-bold">🆘 SOS Activated</h1>
        {groupMode && fcmSentTo > 0 ? (
          <p className="mt-4 text-center text-sm text-red-100">
            FCM alert sent to {fcmSentTo} group member{fcmSentTo === 1 ? "" : "s"}
          </p>
        ) : null}

        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-red-100">
          Send SMS to emergency contacts
        </p>

        {emergencyContacts.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-red-800/60 px-4 py-5 text-center">
            <p className="text-sm">No emergency contacts added</p>
            <button
              type="button"
              onClick={onAddContacts}
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700"
            >
              Add contacts
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {emergencyContacts.map((contact) => (
              <li key={`${contact.name}-${contact.phone}`}>
                <a
                  href={`sms:${contact.phone}?body=${encodeURIComponent(smsTemplate)}`}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-red-800 shadow-lg"
                >
                  <span className="text-sm font-semibold">
                    {contact.name} — {contact.phone}
                  </span>
                  <MessageSquare size={18} />
                </a>
              </li>
            ))}
          </ul>
        )}

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-white/30 px-4 py-3 text-sm font-semibold"
        >
          Open my location
          <ExternalLink size={16} />
        </a>
      </div>

      {canDismiss ? (
        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancelSos}
            className="w-full rounded-2xl bg-green-600 py-4 text-base font-bold text-white shadow-lg"
          >
            I&apos;m okay — Cancel SOS
          </button>
        </div>
      ) : (
        <p className="pb-8 text-center text-xs text-red-100">
          Cancel option available in a few seconds…
        </p>
      )}
    </div>
  );
}
