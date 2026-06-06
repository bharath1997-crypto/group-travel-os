"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Search, X } from "lucide-react";

import WayraIcon from "@/components/ui/WayraIcon";
import { emitOpenWayra } from "@/lib/open-wayra";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function HeaderSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const submitSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
  }, [query, router]);

  const toggleVoice = useCallback(() => {
    if (!voiceSupported) return;

    if (listening) {
      stopListening();
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        setQuery((prev) => {
          const base = prev.trim();
          return base ? `${base} ${transcript.trim()}` : transcript.trim();
        });
      }
    };

    recognition.onerror = () => stopListening();
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, stopListening, voiceSupported]);

  useEffect(() => () => stopListening(), [stopListening]);

  const openWayra = () => {
    const trimmed = query.trim();
    emitOpenWayra(trimmed ? { prompt: trimmed } : undefined);
  };

  return (
    <div
      className="w-full max-w-[584px]"
      role="search"
      aria-label="Site search"
    >
      <div className="flex h-11 w-full items-center gap-2 rounded-full border border-stone-200/90 bg-white px-4 shadow-[0_1px_6px_rgba(32,33,36,0.08)] transition-shadow hover:shadow-[0_1px_6px_rgba(32,33,36,0.14)] focus-within:border-stone-300 focus-within:shadow-[0_1px_6px_rgba(32,33,36,0.14)]">
        <input
          type="search"
          placeholder="Search destinations, trips, activities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
          aria-label="Search destinations, trips, and activities"
        />

        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            aria-label="Clear search"
          >
            <X size={16} strokeWidth={2} />
          </button>
        ) : null}

        {voiceSupported ? (
          <>
            <span className="h-5 w-px shrink-0 bg-stone-200" aria-hidden />
            <button
              type="button"
              onClick={toggleVoice}
              className={`shrink-0 rounded-full p-1.5 transition-colors ${
                listening
                  ? "text-red-500 hover:bg-red-50"
                  : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              }`}
              aria-label={listening ? "Stop voice input" : "Search by voice"}
              title={listening ? "Listening… click to stop" : "Search by voice"}
            >
              {listening ? <MicOff size={18} strokeWidth={1.75} /> : <Mic size={18} strokeWidth={1.75} />}
            </button>
          </>
        ) : null}

        <span className="h-5 w-px shrink-0 bg-stone-200" aria-hidden />

        <button
          type="button"
          onClick={openWayra}
          className="shrink-0 rounded-full p-0.5 transition-transform hover:scale-105"
          aria-label="Ask Wayra"
          title="Ask Wayra"
        >
          <WayraIcon state="flying" size={0.28} variant="raw" animate />
        </button>

        <button
          type="button"
          onClick={submitSearch}
          className="shrink-0 rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-[#0F766E]"
          aria-label="Search"
          title="Search"
        >
          <Search size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
