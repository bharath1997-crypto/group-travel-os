"use client";

import { useCallback, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  sessionCode: string;
  tripTitle?: string;
};

export function SessionQRCode({ sessionCode, tripTitle }: Props) {
  const qrValue =
    typeof window !== "undefined"
      ? `${window.location.origin}/live?code=${encodeURIComponent(sessionCode)}`
      : sessionCode;

  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [sessionCode]);

  const share = useCallback(async () => {
    const sharePayload = {
      title: `${tripTitle ? `${tripTitle} — ` : ""}Live session`,
      text: `Join our live Rovvy session — code ${sessionCode}`,
      url:
        typeof window !== "undefined"
          ? `${window.location.origin}/live?code=${encodeURIComponent(sessionCode)}`
          : "",
    };
    try {
      if (navigator.share) await navigator.share(sharePayload);
      else await onCopy();
    } catch {
      /* user cancelled share */
    }
  }, [onCopy, sessionCode, tripTitle]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#1f3a61] bg-[#0f1f44] px-6 py-6 text-white">
      <QRCodeSVG
        value={
          qrValue.startsWith("http") ? qrValue : `travello-live:${sessionCode}`
        }
        size={200}
        level="M"
        includeMargin={false}
        bgColor="#0f1f44"
        fgColor="#ffffff"
      />
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-[0.12em] text-[#8fa6d3]">
          Session code
        </p>
        <p className="font-mono text-3xl font-bold tracking-[0.35em]" translate="no">
          {sessionCode}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => share()}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-[#081021] shadow"
          style={{ backgroundColor: "#E94560" }}
        >
          Share
        </button>
      </div>
    </div>
  );
}
