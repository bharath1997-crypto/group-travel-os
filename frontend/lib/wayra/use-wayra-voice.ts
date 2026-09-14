"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelWayraSpeech,
  ensureMicrophoneAccess,
  isWayraVoiceSupported,
  listenForSpeech,
  speakWayraText,
} from "@/lib/wayra/wayra-speech";

export type WayraVoicePhase = "idle" | "listening" | "thinking" | "speaking" | "unsupported";

type UseWayraVoiceOptions = {
  ask: (transcript: string) => Promise<string | null>;
  enabled?: boolean;
  speakerOn?: boolean;
};

export function useWayraVoice({ ask, enabled = true, speakerOn = true }: UseWayraVoiceOptions) {
  const [phase, setPhase] = useState<WayraVoicePhase>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stopListenRef = useRef<(() => void) | null>(null);
  const latestRef = useRef("");
  const wantListenRef = useRef(false);
  const submittingRef = useRef(false);
  const askRef = useRef(ask);
  askRef.current = ask;
  const speakerOnRef = useRef(speakerOn);
  speakerOnRef.current = speakerOn;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    setPhase(isWayraVoiceSupported() ? "idle" : "unsupported");
  }, [enabled]);

  const stopEngine = useCallback(() => {
    stopListenRef.current?.();
    stopListenRef.current = null;
  }, []);

  const submitTranscript = useCallback(async (raw: string) => {
    const transcript = raw.trim();
    if (!transcript || submittingRef.current) return;
    submittingRef.current = true;
    wantListenRef.current = false;
    stopEngine();
    setPhase("thinking");

    try {
      const reply = await askRef.current(transcript);
      if (!reply?.trim()) {
        submittingRef.current = false;
        setPhase("idle");
        return;
      }
      setPhase("speaking");
      if (!speakerOnRef.current) {
        submittingRef.current = false;
        setPhase("idle");
        return;
      }
      speakWayraText(reply, {
        onEnd: () => {
          submittingRef.current = false;
          setPhase("idle");
        },
        onError: () => {
          submittingRef.current = false;
          setPhase("idle");
        },
      });
    } catch {
      submittingRef.current = false;
      setPhase("idle");
    }
  }, [stopEngine]);

  const haltListen = useCallback(() => {
    wantListenRef.current = false;
    submittingRef.current = false;
    stopEngine();
    latestRef.current = "";
    setInterimTranscript("");
    setPhase(isWayraVoiceSupported() ? "idle" : "unsupported");
  }, [stopEngine]);

  const cancel = useCallback(() => {
    haltListen();
    cancelWayraSpeech();
  }, [haltListen]);

  useEffect(() => () => {
    wantListenRef.current = false;
    stopEngine();
    cancelWayraSpeech();
  }, [stopEngine]);

  const armRecognition = useCallback(() => {
    stopEngine();
    stopListenRef.current = listenForSpeech({
      continuous: true,
      lang: "en-US",
      onInterim: (t) => {
        latestRef.current = t;
        setInterimTranscript(t);
      },
      onFinal: () => {
        /* submitted only when the user stops, or the engine ends with text */
      },
      onError: (error) => {
        wantListenRef.current = false;
        stopEngine();
        submittingRef.current = false;
        setPhase("idle");
        if (error === "not-allowed") {
          setErrorMessage("Microphone is blocked. Allow it, then tap the mic again.");
        } else if (error === "service-not-allowed") {
          setErrorMessage("Voice isn’t available in this browser. Try Chrome or Edge.");
        } else {
          setErrorMessage("Couldn’t hear that. Tap the mic and try again.");
        }
      },
      onEnd: () => {
        stopListenRef.current = null;
        if (submittingRef.current) return;
        if (wantListenRef.current) {
          window.setTimeout(() => {
            if (wantListenRef.current && !submittingRef.current) armRecognition();
          }, 200);
        }
      },
    });
  }, [stopEngine, submitTranscript]);

  const runVoiceTurn = useCallback(async () => {
    if (submittingRef.current || wantListenRef.current) return;
    if (!isWayraVoiceSupported()) {
      setPhase("unsupported");
      setErrorMessage("Voice needs Chrome or Edge with a microphone.");
      return;
    }

    setErrorMessage(null);
    cancelWayraSpeech();
    latestRef.current = "";
    setInterimTranscript("");
    setPhase("listening");

    const permissionError = await ensureMicrophoneAccess();
    if (permissionError) {
      setErrorMessage(permissionError);
      setPhase("idle");
      return;
    }

    wantListenRef.current = true;
    armRecognition();
  }, [armRecognition]);

  const stopAndAnswer = useCallback(() => {
    const heard = latestRef.current.trim();
    wantListenRef.current = false;
    stopEngine();
    if (!heard) {
      setPhase("idle");
      setErrorMessage("I didn’t catch that. Tap the mic and say it again.");
      return;
    }
    void submitTranscript(heard);
  }, [stopEngine, submitTranscript]);

  return {
    phase,
    supported: typeof window === "undefined" ? true : isWayraVoiceSupported(),
    interimTranscript,
    errorMessage,
    runVoiceTurn,
    stopAndAnswer,
    cancel,
    haltListen,
    isActive: phase === "listening" || phase === "thinking" || phase === "speaking",
  };
}
