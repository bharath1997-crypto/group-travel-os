"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Bot } from "lucide-react";
import { ref as rtdbRef, onValue, push, type Database } from "firebase/database";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: number;
  is_ai?: boolean;
}

interface GroupChatProps {
  tripId: string;
  firebaseDb: Database | null;
  currentUserId: string | null;
  currentUserName: string;
}

export function GroupChat({
  tripId,
  firebaseDb,
  currentUserId,
  currentUserName,
}: GroupChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firebaseDb) return;

    // Listen to the chat ref (as specified in step 4: trips/{trip_id}/chat)
    const chatRef = rtdbRef(firebaseDb, `trips/${tripId}/chat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: ChatMessage[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        list.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(list);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [tripId, firebaseDb]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!firebaseDb || !inputText.trim() || !currentUserId) return;

    const chatRef = rtdbRef(firebaseDb, `trips/${tripId}/chat`);
    push(chatRef, {
      sender_id: currentUserId,
      sender_name: currentUserName || "Traveler",
      message: inputText.trim(),
      timestamp: Date.now(),
      is_ai: false,
    });
    setInputText("");
  };

  // Mock walkie talkie voice transcript simulation to WOW the user
  const handleWalkieTalkie = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    setIsRecording(true);
    // Beep sound
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, context.currentTime);
      osc.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.12);
    } catch {}

    setTimeout(() => {
      setIsRecording(false);
      setInputText("Standing by at the gate, over.");
    }, 2500);
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
      {/* Messages Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <Bot size={28} className="text-[#0F766E] opacity-40 mb-2 animate-bounce" />
            <p className="text-xs font-bold">No messages yet</p>
            <p className="text-[10px] text-slate-500 mt-1">Start coordinating in real-time!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            const isAi = msg.is_ai;

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                {/* Sender Name / Wayra AI header */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 pl-1">
                    {isAi ? (
                      <>
                        <div className="h-4 w-4 rounded-md bg-teal-500/10 text-[#0F766E] flex items-center justify-center shrink-0">
                          <Bot size={10} />
                        </div>
                        <span className="text-[10px] font-black text-[#0F766E]">Wayra AI</span>
                      </>
                    ) : (
                      <span className="text-[9px] font-black text-slate-455">
                        {msg.sender_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${
                    isMe
                      ? "bg-[#0F766E] text-white rounded-tr-none"
                      : isAi
                        ? "bg-[#E1F5EE] border border-[#0F766E] text-slate-800 rounded-tl-none"
                        : "bg-[#F8FAFC] border border-slate-200 text-slate-700 rounded-tl-none"
                  }`}
                >
                  {msg.message}
                </div>

                {/* Timestamp */}
                <span className="text-[8px] text-slate-400 font-bold mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-2 py-1.5 focus-within:border-[#0F766E] focus-within:bg-white transition"
        >
          {/* Walkie-Talkie microphone button */}
          <button
            type="button"
            onClick={handleWalkieTalkie}
            className={`p-2.5 rounded-full transition flex items-center justify-center shrink-0 ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-slate-205 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
            }`}
            title="Walkie-Talkie Transcribe"
          >
            <Mic size={16} />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isRecording ? "Listening..." : "Message the crew..."}
            disabled={isRecording}
            className="flex-1 min-w-0 bg-transparent border-0 focus:outline-none focus:ring-0 text-xs font-bold text-slate-700 placeholder-slate-400 px-2 py-1"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 bg-[#0F766E] hover:bg-[#0D635C] disabled:opacity-40 text-white rounded-full transition flex items-center justify-center shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
