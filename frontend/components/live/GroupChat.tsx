"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { ref as rtdbRef, onValue, push, type Database } from "firebase/database";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: number;
}

interface GroupChatProps {
  tripId: string;
  firebaseDb: Database | null;
  currentUserId: string | null;
  currentUserName: string;
}

export function GroupChat({ tripId, firebaseDb, currentUserId, currentUserName }: GroupChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firebaseDb) return;

    const chatRef = rtdbRef(firebaseDb, `trips/${tripId}/messages`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: ChatMessage[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        // Sort chronologically
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseDb || !inputText.trim() || !currentUserId) return;

    const chatRef = rtdbRef(firebaseDb, `trips/${tripId}/messages`);
    push(chatRef, {
      sender_id: currentUserId,
      sender_name: currentUserName || "Traveler",
      message: inputText.trim(),
      timestamp: Date.now(),
    });
    setInputText("");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden flex flex-col h-full min-h-[300px]">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#0F766E]" />
        <span className="text-sm font-bold text-slate-800">Live Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs italic py-8">
            No live messages. Start coordinating!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                {!isMe && (
                  <span className="text-[9px] font-bold text-slate-400 mb-0.5 ml-1">
                    {msg.sender_name}
                  </span>
                )}
                <div
                  className={`p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                    isMe
                      ? "bg-[#0F766E] text-white rounded-tr-none shadow-sm shadow-[#0F766E]/10"
                      : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-[8px] text-slate-400 mt-0.5 px-1 font-medium">
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

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message the crew..."
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:border-[#0F766E] text-slate-700 transition"
        />
        <button
          type="submit"
          className="p-2.5 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-xl transition flex items-center justify-center"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
