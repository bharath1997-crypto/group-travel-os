"use client";

import { BrowserMultiFormatReader } from "@zxing/library";
import { useCallback, useEffect, useRef } from "react";

export function LiveQrScanner({
  open,
  onCode,
  onClose,
}: {
  open: boolean;
  onCode: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const haltVideoTracks = useCallback(() => {
    const vid = videoRef.current;
    if (vid?.srcObject) {
      try {
        (vid.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      vid.srcObject = null;
    }
    try {
      readerRef.current?.reset();
    } catch {
      /* noop */
    }
  }, []);

  const stopAll = useCallback(() => {
    haltVideoTracks();
    readerRef.current = null;
  }, [haltVideoTracks]);

  useEffect(() => {
    if (!open) {
      stopAll();
      return undefined;
    }
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let cancelled = false;

    async function boot() {
      try {
        const devices = await reader.listVideoInputDevices();
        const deviceId =
          devices.length > 0 ? devices[0]!.deviceId : null;

        if (cancelled || !videoRef.current) return;

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, _err) => {
            if (!result) return;
            const text = result.getText();
            if (!text.trim()) return;
            const code =
              resolveSessionCode(text) ?? text.trim().toUpperCase().slice(0, 8);
            onCode(code);
            stopAll();
            onClose();
          },
        );
      } catch {
        /* camera blocked */
      }
    }
    void boot();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [onClose, onCode, open, stopAll]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[4100] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-semibold">Scan session QR</p>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            stopAll();
            onClose();
          }}
        >
          Cancel
        </button>
      </div>
      <video
        ref={videoRef}
        className="mx-auto h-[60vh] w-full max-w-lg flex-1 bg-black object-cover"
        muted
        playsInline
      />
      <p className="px-4 pb-6 pt-3 text-center text-xs text-white/70">
        Point the camera at the Travello live QR on another device.
      </p>
    </div>
  );
}

function resolveSessionCode(raw: string): string | null {
  const t = raw.trim();
  try {
    const u = new URL(t);
    const c = u.searchParams.get("code");
    if (c && c.length >= 6) return c.toUpperCase();
  } catch {
    /* not url */
  }
  const m = t.match(/code=([A-Z0-9]{6,12})/i);
  if (m?.[1]) return m[1]!.toUpperCase();
  if (/^[A-Z0-9]{8}$/i.test(t)) return t.toUpperCase();
  return null;
}
