const VOICE_MUTED_KEY = "rovvy_voice_muted";

export function isVoiceMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VOICE_MUTED_KEY) === "1";
}

export function setVoiceMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOICE_MUTED_KEY, muted ? "1" : "0");
}

export function speakWayra(
  text: string,
  priority: "low" | "normal" | "urgent" = "normal",
): void {
  if (typeof window === "undefined") return;
  if (isVoiceMuted()) return;
  if (!("speechSynthesis" in window)) return;

  if (priority === "urgent") {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (voice) =>
      voice.lang === "en-US" &&
      (voice.name.includes("Samantha") ||
        voice.name.includes("Google") ||
        voice.name.includes("Female")),
  );
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
