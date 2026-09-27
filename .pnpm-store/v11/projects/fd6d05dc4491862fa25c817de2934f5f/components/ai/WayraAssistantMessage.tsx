"use client";

import { Check } from "lucide-react";

import {
  WAYRA_ACTION_PILL,
  WAYRA_ASSISTANT_BODY,
  WAYRA_ASSISTANT_CARD,
  WAYRA_ASSISTANT_META,
  WAYRA_FOLLOWUP_PILL,
  WAYRA_PENDING,
  WAYRA_PENDING_SPINNER,
  WAYRA_PLACE_CARD,
} from "@/lib/wayra/wayra-chat-tokens";

type SuggestedAction = {
  type: string;
  label: string;
  target?: string | null;
  payload?: Record<string, unknown> | null;
};

type SourceLink = {
  label: string;
  url: string;
  source_type: string;
  snippet?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type WayraAssistantMessageProps = {
  text: string;
  createdAt: number;
  pending?: boolean;
  suggestedActions?: SuggestedAction[];
  sources?: SourceLink[];
  followUpPrompts?: string[];
  loading?: boolean;
  onActionPill: (type: string, label: string, target?: string | null) => void;
  onSourceClick: (source: SourceLink, event: React.MouseEvent<HTMLAnchorElement>) => void;
  onFollowUp: (prompt: string) => void;
};

export function WayraAssistantMessage({
  text,
  pending,
  suggestedActions,
  sources,
  followUpPrompts,
  loading,
  onActionPill,
  onSourceClick,
  onFollowUp,
}: WayraAssistantMessageProps) {
  if (pending) {
    return (
      <div className={WAYRA_PENDING} aria-live="polite">
        <span className="inline-flex items-center gap-2">
          <span className={WAYRA_PENDING_SPINNER} aria-hidden />
          Wayra is thinking…
        </span>
      </div>
    );
  }

  return (
    <article className={WAYRA_ASSISTANT_CARD}>
      <div className={WAYRA_ASSISTANT_BODY}>{text}</div>
      {sources && sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((s, i) => (
            <a
              key={`${s.url}-${s.label}`}
              href={s.url}
              target={s.url.startsWith("/") ? undefined : "_blank"}
              rel={s.url.startsWith("/") ? undefined : "noopener noreferrer"}
              onClick={(event) => onSourceClick(s, event)}
              className={WAYRA_PLACE_CARD}
            >
              <span className="h-11 w-11 shrink-0 rounded-full bg-[#E8E4DC]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-[#0F1614]">
                  {s.label}
                </span>
                {s.snippet ? (
                  <span className="mt-0.5 block truncate text-[12px] text-[#6B7280]">
                    {s.snippet}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-[#9CA3AF]">{i + 1}</span>
            </a>
          ))}
        </div>
      ) : null}
      {suggestedActions && suggestedActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestedActions.map((a, i) => (
            <button
              key={`${a.type}-${a.label}-${i}`}
              type="button"
              onClick={() => onActionPill(a.type, a.label, a.target)}
              className={i === 0 ? WAYRA_ACTION_PILL : "rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-[#0F1614] shadow-sm"}
            >
              {i === 0 ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {a.label}
                </span>
              ) : (
                a.label
              )}
            </button>
          ))}
        </div>
      ) : null}
      {followUpPrompts && followUpPrompts.length > 0 ? (
        <div className={WAYRA_ASSISTANT_META}>
          {followUpPrompts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              disabled={loading}
              className={WAYRA_FOLLOWUP_PILL}
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
