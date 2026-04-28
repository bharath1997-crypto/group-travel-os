"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import { SettingsScreenHeader, SettingsSectionTitle, SettingsToggleRow } from "../_components";

export default function SettingsInteractionsPage() {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const b = await fetchAppSettings();
    setPrefs(b.preferences);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (id) {
      window.requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }, [prefs]);

  async function merge(patch: AppPreferences) {
    setBusy(true);
    try {
      const b = await patchAppSettings(patch);
      setPrefs(b.preferences);
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) {
    return (
      <>
        <SettingsScreenHeader title="Interactions" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const i = prefSection<Record<string, unknown>>(prefs, "interactions");
  const lim = Boolean(i.limit_interactions);
  const hidden = Boolean(i.hidden_words_enabled);

  return (
    <>
      <SettingsScreenHeader title="Interactions" backHref="/settings" />
      <div id="messages" className="scroll-mt-16">
        <SettingsSectionTitle>Messages &amp; replies</SettingsSectionTitle>
        <p className="px-4 pb-2 text-xs text-stone-500">
          Controls apply to in-app trip chat and story replies.
        </p>
        <div className="space-y-1 px-4 pb-3">
          {(
            [
              ["messages_from", "Who can message you"],
              ["story_replies_from", "Who can reply to trip stories"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex flex-wrap gap-2 py-2">
              <span className="w-full text-[13px] font-medium text-stone-800">
                {label}
              </span>
              {(
                [
                  ["everyone", "Everyone"],
                  ["followers", "Connections only"],
                  ["off", "Off"],
                ] as const
              ).map(([v, lab]) => (
                <button
                  key={v}
                  type="button"
                  disabled={busy}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    String(i[key] ?? "everyone") === v
                      ? "bg-[#E94560] text-white"
                      : "bg-stone-100 text-stone-700"
                  }`}
                  onClick={() =>
                    void merge({ interactions: { [key]: v } })
                  }
                >
                  {lab}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div id="tags" className="scroll-mt-16">
        <ChoiceRow
          label="Tags & mentions"
          value={String(i.tags_and_mentions ?? "everyone")}
          busy={busy}
          onChange={(v) => void merge({ interactions: { tags_and_mentions: v } })}
        />
      </div>
      <div id="comments" className="scroll-mt-16">
        <ChoiceRow
          label="Comments"
          value={String(i.comments_from ?? "followers")}
          busy={busy}
          onChange={(v) => void merge({ interactions: { comments_from: v } })}
        />
      </div>
      <div id="sharing" className="scroll-mt-16">
        <ChoiceRow
          label="Sharing"
          value={String(i.sharing_from ?? "everyone")}
          busy={busy}
          onChange={(v) => void merge({ interactions: { sharing_from: v } })}
        />
      </div>
      <div id="restricted" className="scroll-mt-16">
        <SettingsSectionTitle>Restricted accounts</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Limited accounts see less of your trips without a full block. Use
          travel hub to pick people — counts appear on the settings home screen.
        </p>
      </div>
      <div id="limit" className="scroll-mt-16">
        <SettingsToggleRow
          label="Limit interactions"
          sublabel="Quiet new requests from people you do not follow"
          checked={lim}
          busy={busy}
          onToggle={(v) => void merge({ interactions: { limit_interactions: v } })}
        />
      </div>
      <div id="hidden" className="scroll-mt-16">
        <SettingsToggleRow
          label="Hidden words"
          sublabel="Filter certain words from comments and requests"
          checked={hidden}
          busy={busy}
          onToggle={(v) =>
            void merge({ interactions: { hidden_words_enabled: v } })
          }
        />
      </div>
    </>
  );
}

function ChoiceRow({
  label,
  value,
  busy,
  onChange,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-stone-100 px-4 py-3">
      <p className="text-[15px] text-neutral-900">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            ["everyone", "Everyone"],
            ["followers", "Connections"],
            ["off", "Off"],
          ] as const
        ).map(([v, lab]) => (
          <button
            key={v}
            type="button"
            disabled={busy}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              value === v
                ? "bg-[#E94560] text-white"
                : "bg-stone-100 text-stone-700"
            }`}
            onClick={() => onChange(v)}
          >
            {lab}
          </button>
        ))}
      </div>
    </div>
  );
}
