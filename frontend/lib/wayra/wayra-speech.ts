/** Browser speech helpers for Wayra voice mode (STT + TTS). */

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [i: number]: {
            isFinal?: boolean;
            [j: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isWayraVoiceSupported(): boolean {
  return isSpeechRecognitionSupported();
}

/** Chrome fires these when silence hits or we call stop() — not real failures. */
export function isIgnorableSpeechError(error?: string): boolean {
  return error === "no-speech" || error === "aborted";
}

export async function ensureMicrophoneAccess(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Microphone is blocked. Allow it for this site, then tap the mic again.";
    }
    if (name === "NotFoundError") {
      return "No microphone found on this device.";
    }
    return "Could not open the microphone. Check browser permissions.";
  }
}

/** Strip markdown-ish noise before TTS. */
export function textForSpeech(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pickWayraVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      /samantha|google uk english female|karen|moira|zira|female/i.test(v.name),
  );
  if (preferred) return preferred;

  return voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null;
}

export function cancelWayraSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakWayraText(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): void {
  if (!isSpeechSynthesisSupported()) {
    opts?.onError?.();
    return;
  }

  const cleaned = textForSpeech(text);
  if (!cleaned) {
    opts?.onEnd?.();
    return;
  }

  cancelWayraSpeech();
  window.speechSynthesis.resume();

  const speakNow = () => {
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = "en-US";
    utter.rate = 1.02;
    utter.pitch = 1.05;
    const voice = pickWayraVoice();
    if (voice) utter.voice = voice;
    utter.onstart = () => opts?.onStart?.();
    utter.onend = () => opts?.onEnd?.();
    utter.onerror = () => opts?.onError?.();
    window.speechSynthesis.speak(utter);
  };

  if (!window.speechSynthesis.getVoices().length) {
    let started = false;
    const once = () => {
      if (started) return;
      started = true;
      speakNow();
    };
    window.speechSynthesis.addEventListener("voiceschanged", once, { once: true });
    window.setTimeout(once, 250);
    return;
  }

  window.setTimeout(speakNow, 40);
}

export type ListenForSpeechOptions = {
  lang?: string;
  continuous?: boolean;
  onInterim?: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError?: (error?: string) => void;
  onEnd?: () => void;
};

/** Listen until stop(); submits the latest English transcript. */
export function listenForSpeech(options: ListenForSpeechOptions): () => void {
  const SR = getSpeechRecognition();
  if (!SR) {
    options.onError?.();
    options.onEnd?.();
    return () => undefined;
  }

  const recognition = new SR();
  recognition.continuous = options.continuous ?? true;
  recognition.interimResults = true;
  recognition.lang = options.lang ?? "en-US";

  let latest = "";

  recognition.onresult = (event) => {
    let committed = "";
    let interim = "";
    for (let i = 0; i < event.results.length; i++) {
      const piece = event.results[i][0]?.transcript ?? "";
      if (event.results[i].isFinal) committed += `${piece} `;
      else interim += piece;
    }
    latest = `${committed}${interim}`.replace(/\s+/g, " ").trim();
    if (latest) options.onInterim?.(latest);
  };

  recognition.onerror = (event) => {
    const error = event?.error;
    if (isIgnorableSpeechError(error)) return;
    options.onError?.(error);
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    options.onError?.();
    options.onEnd?.();
    return () => undefined;
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  };
}
